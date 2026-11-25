"""Rule-based soil interpretation. Thresholds are configurable examples, not lab standards."""

CROPS = [
    {"name":"ข้าว", "group":"พืชไร่", "ph":[5.0,7.0], "n":[20,60], "p":[10,30], "k":[40,160], "water":"ต้องการน้ำมาก โดยเฉพาะช่วงตั้งตัวและสร้างรวง", "tip":"เตรียมแปลงและจัดการน้ำให้เหมาะกับพันธุ์และฤดูปลูก"},
    {"name":"ข้าวโพด", "group":"พืชไร่", "ph":[5.5,7.5], "n":[40,100], "p":[15,40], "k":[60,180], "water":"ต้องการน้ำสม่ำเสมอในช่วงออกดอกและติดเมล็ด", "tip":"ใส่ปุ๋ยแบ่งตามระยะการเจริญเติบโต"},
    {"name":"มันสำปะหลัง", "group":"พืชไร่", "ph":[5.0,7.0], "n":[20,60], "p":[10,30], "k":[80,200], "water":"ทนแล้งได้เมื่อโตแล้ว แต่ไม่ควรมีน้ำขัง", "tip":"เลือกดินระบายน้ำดีและใช้ท่อนพันธุ์สมบูรณ์"},
    {"name":"อ้อย", "group":"พืชไร่", "ph":[5.5,7.5], "n":[40,100], "p":[15,40], "k":[80,200], "water":"ต้องการน้ำในช่วงเจริญเติบโต", "tip":"บำรุงดินและจัดการวัชพืชในระยะแรก"},
    {"name":"ถั่วเหลือง", "group":"พืชไร่", "ph":[5.5,7.0], "n":[15,50], "p":[20,45], "k":[50,140], "water":"ไม่ควรขาดน้ำช่วงออกดอกและติดฝัก", "tip":"คลุกเมล็ดด้วยเชื้อไรโซเบียมที่เหมาะสมก่อนปลูก"},
    {"name":"ผักบุ้ง", "group":"พืชผัก", "ph":[5.5,7.5], "n":[30,80], "p":[15,35], "k":[40,120], "water":"ต้องการความชื้นสม่ำเสมอ", "tip":"เก็บเกี่ยวได้เร็วและทยอยปลูกเป็นรุ่น"},
    {"name":"คะน้า", "group":"พืชผัก", "ph":[5.5,7.0], "n":[40,90], "p":[20,40], "k":[60,150], "water":"ต้องการน้ำสม่ำเสมอ", "tip":"เพิ่มอินทรียวัตถุและหลีกเลี่ยงน้ำขัง"},
    {"name":"กะหล่ำปลี", "group":"พืชผัก", "ph":[6.0,7.5], "n":[50,100], "p":[20,45], "k":[80,180], "water":"ต้องการน้ำสม่ำเสมอและอากาศค่อนข้างเย็น", "tip":"เหมาะกับฤดูและพื้นที่อากาศเย็น"},
    {"name":"แตงกวา", "group":"พืชผัก", "ph":[5.5,7.0], "n":[30,70], "p":[20,40], "k":[60,150], "water":"ต้องการน้ำสม่ำเสมอแต่ไม่ชอบน้ำขัง", "tip":"ทำค้างและเก็บผลตามอายุ"},
    {"name":"พริก", "group":"พืชผัก", "ph":[5.5,7.0], "n":[30,70], "p":[20,45], "k":[70,160], "water":"ให้น้ำสม่ำเสมอโดยเฉพาะช่วงติดผล", "tip":"ระบายน้ำดีและเฝ้าระวังโรคจากความชื้น"},
    {"name":"มะเขือเทศ", "group":"พืชผัก", "ph":[5.5,7.0], "n":[30,70], "p":[25,50], "k":[80,180], "water":"ต้องการน้ำสม่ำเสมอ ไม่ควรเปียกแฉะ", "tip":"ใช้ค้างเมื่อจำเป็นและหลีกเลี่ยงความชื้นที่ใบ"},
    {"name":"มะม่วง", "group":"ไม้ผล", "ph":[5.5,7.5], "n":[20,60], "p":[15,40], "k":[60,160], "water":"ต้องการน้ำช่วงตั้งตัวและขยายผล", "tip":"เลือกพันธุ์เหมาะพื้นที่และเว้นระยะปลูก"},
    {"name":"กล้วย", "group":"ไม้ผล", "ph":[5.5,7.0], "n":[40,90], "p":[20,45], "k":[100,220], "water":"ต้องการน้ำและโพแทสเซียมค่อนข้างมาก", "tip":"ใส่อินทรียวัตถุและค้ำต้นเมื่อเครือใหญ่"},
    {"name":"มะนาว", "group":"ไม้ผล", "ph":[5.5,7.0], "n":[30,70], "p":[20,45], "k":[70,170], "water":"ต้องการน้ำสม่ำเสมอแต่ระบายน้ำดี", "tip":"ตัดแต่งกิ่งและจัดการโรคแมลงสม่ำเสมอ"},
    {"name":"ฝรั่ง", "group":"ไม้ผล", "ph":[5.0,7.5], "n":[30,70], "p":[15,40], "k":[60,160], "water":"ต้องการน้ำสม่ำเสมอช่วงติดผล", "tip":"ตัดแต่งทรงพุ่มและห่อผลตามความเหมาะสม"},
    {"name":"ส้ม", "group":"ไม้ผล", "ph":[5.5,7.0], "n":[30,70], "p":[20,45], "k":[80,180], "water":"ต้องการน้ำสม่ำเสมอและไม่ทนน้ำขัง", "tip":"ตรวจโรครากและจัดการดินระบายน้ำดี"},
    {"name":"มะละกอ", "group":"ไม้ผล", "ph":[5.5,7.0], "n":[30,70], "p":[20,45], "k":[70,170], "water":"ต้องการน้ำสม่ำเสมอแต่ไม่ชอบน้ำขัง", "tip":"เลือกพื้นที่แดดจัดและระบายน้ำดี"},
    {"name":"กวางตุ้ง", "group":"พืชผัก", "ph":[5.5,7.0], "n":[30,80], "p":[15,40], "k":[50,140], "water":"ต้องการน้ำสม่ำเสมอและดินระบายน้ำดี", "tip":"เพิ่มอินทรียวัตถุและเก็บเกี่ยวเมื่อมีขนาดเหมาะสม"},
    {"name":"ผักบุ้งจีน", "group":"พืชผัก", "ph":[5.5,7.5], "n":[30,80], "p":[15,35], "k":[40,120], "water":"ต้องการความชื้นสม่ำเสมอ", "tip":"ปลูกในดินร่วนชุ่มชื้นและเก็บเกี่ยวตามอายุ"},
    {"name":"ถั่วฝักยาว", "group":"พืชผัก", "ph":[5.5,7.0], "n":[15,50], "p":[20,45], "k":[50,140], "water":"ต้องการน้ำสม่ำเสมอ โดยเฉพาะช่วงออกดอกและติดฝัก", "tip":"ทำค้างให้ต้นเลื้อยและดูแลการระบายน้ำ"}
]

THRESHOLDS = {
    "N": [(20,"ต่ำมาก"),(40,"ต่ำ"),(80,"ปานกลาง"),(120,"สูง"),(float('inf'),"สูงมาก")],
    "P": [(5,"ต่ำมาก"),(10,"ต่ำ"),(25,"ปานกลาง"),(50,"สูง"),(float('inf'),"สูงมาก")],
    "K": [(30,"ต่ำมาก"),(60,"ต่ำ"),(120,"ปานกลาง"),(200,"สูง"),(float('inf'),"สูงมาก")],
}

def band(value, ranges):
    for limit, label in ranges:
        if value <= limit: return label
    return ranges[-1][1]

def _range_score(value, low, high):
    span = max(high-low, 1)
    midpoint = (low + high) / 2
    if low <= value <= high:
        # ให้คะแนนภายในช่วงต่างกันตามความใกล้จุดกึ่งกลาง เพื่อจัดอันดับพืชได้
        return max(85.0, 100.0 - (abs(value-midpoint)/(span/2))*15.0)
    distance = low-value if value < low else value-high
    return max(0.0, 85.0 - (distance/span)*50.0)

def analyze(results):
    by = {x.get('type'): x for x in results if isinstance(x, dict)}
    if not all(k in by for k in ('pH','N','P','K')):
        return {"available":False,"message":"ข้อมูลไม่ครบทั้ง 4 ค่า"}
    try: v = {k: float(by[k]['value']) for k in ('pH','N','P','K')}
    except (KeyError,TypeError,ValueError): return {"available":False,"message":"ข้อมูลตัวเลขไม่ถูกต้อง"}
    if not (0 <= v['pH'] <= 14) or any(v[k] < 0 for k in ('N','P','K')):
        return {"available":False,"message":"ค่าที่ได้รับอยู่นอกช่วงที่รองรับ"}
    if v['pH'] <= 4.5: ph_label='ดินกรดจัด'
    elif v['pH'] <= 5.5: ph_label='ดินกรด'
    elif v['pH'] <= 6.5: ph_label='ดินกรดอ่อน'
    elif v['pH'] <= 7.5: ph_label='ดินเป็นกลาง'
    elif v['pH'] <= 8.5: ph_label='ดินด่างอ่อน'
    else: ph_label='ดินด่างจัด'
    sample_scale = any(('ตัวอย่าง' in str(by[k].get('unit','')) or '0-5' in str(by[k].get('unit','')) or 'ประมาณ' in str(by[k].get('unit','')) or 'สอบเทียบ' in str(by[k].get('unit',''))) for k in ('N','P','K'))
    if sample_scale or (
    all(v[k] in (0, 1, 2, 3, 4) for k in ('N', 'P', 'K'))
    and not all(
        'mg/kg' in str(by[k].get('unit', '')).lower()
        or 'ppm' in str(by[k].get('unit', '')).lower()
        for k in ('N', 'P', 'K')
    )
):
        # แสดงระดับ NPK ตามเกณฑ์ที่ผู้ใช้กำหนด แต่ไม่ใช้ค่าประมาณจัดอันดับพืชจนกว่าจะสอบเทียบ
        scale_labels = {0: "ขาดแคลนวิกฤต", 1: "ขาดแคลน", 2: "พอใช้", 3: "เพียงพอ", 4: "มากเกินไป"}
        nutrient_labels = {k: (scale_labels[int(v[k])] if v[k].is_integer() and int(v[k]) in scale_labels else "อยู่นอกเกณฑ์ระดับสี") for k in ('N','P','K')}
        ph_crops=[]
        for crop in CROPS:
            ph_score=round(_range_score(v['pH'], *crop['ph']))
            ph_crops.append({"name":crop["name"],"group":crop["group"],"score":ph_score,
                "reasons":["ค่า pH อยู่ในช่วงที่เหมาะสม (ประเมินจาก pH เท่านั้น)"],
                "ph_range":crop["ph"],"needs":{"N":crop["n"],"P":crop["p"],"K":crop["k"]},
                "water":crop["water"],"tip":crop["tip"]})
        ph_crops.sort(key=lambda x:x["score"],reverse=True)
        return {"available":True,"calibrated":False,"soil_type":ph_label,"fertility":"ยังประเมินไม่ได้",
                "nutrients":nutrient_labels,"recommendations":["ระดับ NPK แสดงตามตารางสี 0–4 แต่ค่าตัวเลขยังเป็นค่าประมาณจากสี ไม่ใช้จัดอันดับพืชจนกว่าจะสอบเทียบ","คำแนะนำพืชด้านล่างเป็นการคัดกรองเบื้องต้นจากค่า pH เท่านั้น","ค่า NPK ยังไม่ใช่ผลวิเคราะห์ mg/kg ที่ผ่านการสอบเทียบ กรุณาสอบเทียบกับชุดน้ำยาจริงก่อนใช้เลือกปุ๋ยหรือยืนยันชนิดพืช"],
                "crops":ph_crops,"values":v,"method":"คัดกรองพืชเบื้องต้นจาก pH เท่านั้น; NPK เป็นค่าประมาณ ยังไม่ผ่านการสอบเทียบ",
                "caution":"คะแนนพืชยังไม่รวม NPK และไม่ใช่คำยืนยันว่าปลูกได้แน่นอน"}
    nutrient_labels = {k:band(v[k],THRESHOLDS[k]) for k in ('N','P','K')}
    rank={'ต่ำมาก':0,'ต่ำ':1,'ปานกลาง':2,'สูง':3,'สูงมาก':4}
    avg=sum(rank[x] for x in nutrient_labels.values())/3
    fertility='ต่ำ' if avg<1.5 else ('ปานกลาง' if avg<2.8 else 'สูง')
    recommendations=[]
    if v['pH'] < 5.5: recommendations.append('ดินมีแนวโน้มเป็นกรด ควรตรวจความต้องการปูนก่อนใช้ปูนขาวหรือโดโลไมต์')
    elif v['pH'] > 7.5: recommendations.append('ดินมีแนวโน้มเป็นด่าง ควรตรวจความเค็มและคุณสมบัติดินเพิ่มเติมก่อนปรับปรุง')
    for k,thai in [('N','ไนโตรเจน'),('P','ฟอสฟอรัส'),('K','โพแทสเซียม')]:
        if nutrient_labels[k] in ('ต่ำมาก','ต่ำ'): recommendations.append(f'{thai}อยู่ในระดับ{nutrient_labels[k]} ควรพิจารณาปุ๋ยธาตุอาหารนี้ตามผลวิเคราะห์และความต้องการพืช')
    crops=[]
    for crop in CROPS:
        scores={key:_range_score(v[key],*crop[key.lower() if key=='pH' else key.lower()]) for key in ('pH','N','P','K')}
        score=round(scores['pH']*.4+scores['N']*.2+scores['P']*.2+scores['K']*.2)
        reasons=[]
        if scores['pH']>=80: reasons.append('ค่า pH อยู่ในช่วงใกล้เคียงที่พืชต้องการ')
        if scores['N']>=80: reasons.append('ค่า N อยู่ในช่วงเปรียบเทียบที่เหมาะสม')
        if scores['P']>=80: reasons.append('ค่า P อยู่ในช่วงเปรียบเทียบที่เหมาะสม')
        if scores['K']>=80: reasons.append('ค่า K อยู่ในช่วงเปรียบเทียบที่เหมาะสม')
        crops.append({"name":crop['name'],"group":crop['group'],"score":score,"reasons":reasons or ['คะแนนจากช่วง pH และธาตุอาหารโดยรวมสูงกว่าพืชตัวเลือกอื่น'],"ph_range":crop['ph'],"needs":{"N":crop['n'],"P":crop['p'],"K":crop['k']},"water":crop['water'],"tip":crop['tip']})
    crops.sort(key=lambda x:x['score'],reverse=True)
    units_ok=all(('mg/kg' in str(by[k].get('unit','')).lower() or 'ppm' in str(by[k].get('unit','')).lower()) for k in ('N','P','K'))
    return {
        "available": True,
        "calibrated": units_ok,
        "soil_type": ph_label,
        "fertility": fertility,
        "nutrients": nutrient_labels,
        "recommendations": recommendations,
        "crops": crops,
        "values": v,
        "method": "คะแนนเปรียบเทียบตัวอย่าง: pH 40%, N/P/K อย่างละ 20%",
        "caution": "เกณฑ์และคะแนนเป็นแนวทางสำหรับต้นแบบ ต้องสอบเทียบกับชุดน้ำยาจริงก่อนใช้ตัดสินใจเพาะปลูก"
    }
