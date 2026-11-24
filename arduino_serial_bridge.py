"""Single-owner serial bridge between the camera and Arduino/Nextion.

Arduino forwards Nextion START/STOP over USB. These events are queued for the
camera's main thread, which owns the tracking and backend reset state.
"""
import os
import queue
import threading
import time
import requests


class ArduinoBridge:
    def __init__(self):
        self.port = os.getenv('ARDUINO_PORT', 'COM12').strip()
        self.baud = int(os.getenv('ARDUINO_BAUD', '115200'))
        self.jobs = queue.Queue(maxsize=8)
        self.events = queue.Queue()
        self.stop_event = threading.Event()
        self.thread = None
        self.generation = 0
        self.lock = threading.Lock()
        self.last_delivered = None
        self.pending = None
        self.camera_acks_queued = set()
        self.registration_fields = {}
        self.registration_results = queue.Queue()
        self.registration_busy = False

    def start(self):
        if not self.port:
            print('[ARDUINO] Disabled. Set ARDUINO_PORT=COM12 to enable.')
            # return
        self.thread = threading.Thread(target=self._run, daemon=True, name='arduino-serial')
        self.thread.start()

    def stop(self):
        self.stop_event.set()
        if self.thread:
            self.thread.join(timeout=2.0)

    def pop_events(self):
        events = []
        while True:
            try:
                events.append(self.events.get_nowait())
            except queue.Empty:
                return events

    def reset(self):
        with self.lock:
            self.generation += 1
            self.last_delivered = None
            self.pending = None
            self.camera_acks_queued.clear()
            generation = self.generation
        self._enqueue(('RESET', generation))

    def send_result(self, values):
        group = int(values.get('group', 1))

        if group not in (1, 2, 3, 4, 5):
            group = 1

        payload = 'SOIL,{:.2f},{:.2f},{:.2f},{:.2f},{},0'.format(
            values['pH'], values['N'], values['P'], values['K'], group
        )

        with self.lock:
            if self.last_delivered == payload or self.pending == payload:
                return
            generation = self.generation
            self.pending = payload

        if not self._enqueue((payload, generation)):
            with self.lock:
                if self.pending == payload:
                    self.pending = None

    def ack_camera_position(self, index):
        """Queue position acknowledgement, deduplicated until Arduino confirms."""
        with self.lock:
            generation = self.generation
            key = (generation, int(index))
            if key in self.camera_acks_queued:
                return
            self.camera_acks_queued.add(key)
        if not self._enqueue(('CAMERA_ACK,{}'.format(index), generation)):
            with self.lock:
                self.camera_acks_queued.discard(key)

    def _enqueue(self, item):
        try:
            self.jobs.put_nowait(item)
            return True
        except queue.Full:
            print('[ARDUINO] Serial queue full; retry on next camera frame')
            return False

    def _register_account(self, fields):
        # Keep credentials out of logs; use HTTPS and a private device key.
        status = 'REG_FAIL'
        try:
            backend_url = os.getenv('BACKEND_URL', 'http://127.0.0.1:4000/api/data')
            api_base = backend_url.rsplit('/api/', 1)[0]
            device_key = os.getenv('NEXTION_DEVICE_KEY', '').strip()
            if not device_key:
                print('[NEXTION] NEXTION_DEVICE_KEY is missing')
            elif not api_base.startswith(('https://', 'http://127.0.0.1:', 'http://localhost:')):
                print('[NEXTION] Remote registration requires HTTPS')
            else:
                print('[DEBUG] Sending registration request to Render', flush=True)
                print('[DEBUG] Registration URL:', api_base + '/api/device/register', flush=True)
                response = requests.post(
                    api_base + '/api/device/register',
                    json=fields,
                    headers={'X-Device-Key': device_key}, timeout=15)
                print('[DEBUG] Render HTTP status:', response.status_code, flush=True)
                if response.status_code == 201 and response.json().get('ok'):
                    status = 'REG_OK'
                elif response.status_code == 409:
                    status = 'REG_EXISTS'
                else:
                    print('[NEXTION] Registration failed (HTTP {})'.format(response.status_code))
        except (requests.RequestException, ValueError) as exc:
            print('[NEXTION] Registration request failed:', type(exc).__name__)
        finally:
            fields.clear()
            self.registration_results.put(status)

    def _send_registration_results(self, conn):
        while True:
            try:
                status = self.registration_results.get_nowait()
            except queue.Empty:
                break
            conn.write((status + '\n').encode('ascii'))
            conn.flush()
            self.registration_busy = False
            print('[NEXTION] Registration:', status)

    def _handle_line(self, line):
        print('[DEBUG SERIAL]', repr(line))
        field_names = {
            'REG_U:': 'username',
            'REG_P:': 'password',
            'REG_PHONE:': 'phone',
            'REG_EMAIL:': 'email',
            'REG_FB:': 'facebook',
            'REG_IG:': 'instagram',
        }
        for prefix, field in field_names.items():
            if line.startswith(prefix):
                if self.registration_busy:
                    return
                value = line[len(prefix):]
                if len(value) > 200:
                    self.registration_fields.clear()
                    self.registration_results.put('REG_FAIL')
                    return
                self.registration_fields[field] = value
                print('[NEXTION] Received field:', field)
                return
        if line == 'REG_SUBMIT':
            print('[DEBUG] REG_SUBMIT received, fields:', len(self.registration_fields))
            fields = self.registration_fields
            self.registration_fields = {}

            if (self.registration_busy or len(fields) != 6 or
                    not 3 <= len(fields['username']) <= 40 or
                    not 8 <= len(fields['password']) <= 72 or
                    not fields['phone'].strip()):
                self.registration_results.put('REG_FAIL')
                return

            self.registration_busy = True
            threading.Thread(
                target=self._register_account,
                args=(fields,),
                daemon=True,
                name='nextion-register'
            ).start()
            return
        if line in ('START', 'STOP'):
            print('[NEXTION] Received:', line)
            # STOP/START can arrive during an ACK wait or when idle.
            self.events.put(line)
        elif line == 'CAMERA_START' or line == 'CAMERA_FINISHED' or line.startswith('CAMERA_POS,'):
            print('[ARDUINO] Stage:', line)
            self.events.put(line)
        elif line.startswith('ERR,'):
            print('[ARDUINO] Rejected:', line)

    def _run(self):
        try:
            import serial
        except ImportError:
            print('[ARDUINO] pyserial missing; run pip install pyserial')
            return
        while not self.stop_event.is_set():
            try:
                with serial.Serial(self.port, self.baud, timeout=0.1, write_timeout=1) as conn:
                    print('[ARDUINO] Connected:', self.port, self.baud)
                    time.sleep(2.3)  # Uno USB serial reset/bootloader
                    while not self.stop_event.is_set():
                        self._send_registration_results(conn)
                        # Always read unsolicited START/STOP, including while idle.
                        line = conn.readline().decode('ascii', errors='replace').strip()
                        if line:
                            self._handle_line(line)
                        try:
                            payload, generation = self.jobs.get_nowait()
                        except queue.Empty:
                            continue
                        with self.lock:
                            if generation != self.generation:
                                continue
                        expected = ('ACK,RESET' if payload == 'RESET' else
                                    'ACK,CAMERA_POS,' + payload.split(',')[1] if payload.startswith('CAMERA_ACK,')
                                    else 'ACK,SOIL')
                        delivered = False
                        for attempt in range(3):
                            with self.lock:
                                if generation != self.generation:
                                    break
                            # Do not flush incoming data: it may contain a Nextion STOP.
                            conn.write((payload + '\n').encode('ascii'))
                            conn.flush()
                            deadline = time.monotonic() + 2.0
                            while time.monotonic() < deadline and not self.stop_event.is_set():
                                self._send_registration_results(conn)
                                line = conn.readline().decode('ascii', errors='replace').strip()
                                if line == expected:
                                    delivered = True
                                    break
                                if line:
                                    self._handle_line(line)
                                with self.lock:
                                    if generation != self.generation:
                                        break
                            if delivered:
                                break
                        if delivered:
                            if payload.startswith('CAMERA_ACK,'):
                                with self.lock:
                                    self.camera_acks_queued.discard((generation, int(payload.split(',')[1])))
                            print('[ARDUINO] ACK:', payload)
                            if payload.startswith('SOIL,'):
                                with self.lock:
                                    if generation == self.generation:
                                        self.last_delivered = payload
                                        self.pending = None
                        else:
                            if payload.startswith('CAMERA_ACK,'):
                                with self.lock:
                                    self.camera_acks_queued.discard((generation, int(payload.split(',')[1])))
                            with self.lock:
                                if self.pending == payload:
                                    self.pending = None
                            print('[ARDUINO] No ACK:', payload)
            except (OSError, serial.SerialException) as exc:
                print('[ARDUINO] Port unavailable:', exc)
                self.stop_event.wait(3.0)
