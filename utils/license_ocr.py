import sys
import os
import json
import re
import warnings

# Suppress unnecessary warnings for clean JSON output
warnings.filterwarnings("ignore")
os.environ['FLAGS_allocator_strategy'] = 'naive_best_fit'
os.environ['FLAGS_use_mkldnn'] = '0'
os.environ['FLAGS_enable_pir_api'] = '0'

def parse_license_text(text_lines):
    raw_text = [str(line).strip() for line in text_lines if str(line).strip()]
    full_text = " ".join(raw_text)
    
    license_number = ""
    name_on_license = ""
    dob = ""
    expiry_date = ""
    cov = ""

    # 1. License Number extraction patterns
    # Pattern A: Standard Indian DL format like MH1220210012345 or DL-0420110012345 or KA 01 2020 0012345
    dl_patterns = [
        r'([A-Z]{2}[-\s]?[0-9]{2}[-\s]?[0-9]{4}[-\s]?[0-9]{7})',
        r'([A-Z]{2}[-\s]?[0-9]{2}[-\s]?[0-9]{11})',
        r'([A-Z]{2}[0-9]{13})',
        r'([A-Z]{2}[-\s]?[0-9]{13})',
        r'DL[-\s]?:?[-\s]?([A-Z0-9\s/-]{8,20})',
        r'LICENCE[-\s]?NO[:\.\s]*([A-Z0-9\s/-]{8,20})',
        r'LICENSE[-\s]?NO[:\.\s]*([A-Z0-9\s/-]{8,20})',
        r'NO[\.\s:]*([A-Z]{2}[0-9\s/-]{10,18})'
    ]
    
    for pattern in dl_patterns:
        match = re.search(pattern, full_text, re.IGNORECASE)
        if match:
            found = match.group(1).strip()
            # Clean up punctuation except hyphen
            found_clean = re.sub(r'[^A-Z0-9-]', '', found.upper())
            if len(found_clean) >= 8:
                license_number = found_clean
                break

    # If license number not found in full string, search line by line
    if not license_number:
        for idx, line in enumerate(raw_text):
            if any(k in line.upper() for k in ["DL NO", "LICENCE NO", "LICENSE NO", "DL.NO", "NO."]):
                # Look at current line or next line
                combined = line
                if idx + 1 < len(raw_text):
                    combined += " " + raw_text[idx + 1]
                match = re.search(r'([A-Z0-9/-]{8,20})', combined.upper())
                if match:
                    license_number = match.group(1)
                    break

    # 2. Date Extraction (DOB & Expiry)
    all_dates = re.findall(r'(\d{2}[/-]\d{2}[/-]\d{4})', full_text)
    if not all_dates:
        all_dates = re.findall(r'(\d{4}[/-]\d{2}[/-]\d{2})', full_text)

    # Contextual search for DOB & Expiry
    for idx, line in enumerate(raw_text):
        line_upper = line.upper()
        
        # DOB Check
        if any(k in line_upper for k in ["DOB", "DATE OF BIRTH", "BIRTH", "D.O.B"]):
            match_dob = re.search(r'(\d{2}[/-]\d{2}[/-]\d{4})', line_upper)
            if not match_dob and idx + 1 < len(raw_text):
                match_dob = re.search(r'(\d{2}[/-]\d{2}[/-]\d{4})', raw_text[idx + 1])
            if match_dob:
                dob = match_dob.group(1)

        # Expiry Check
        if any(k in line_upper for k in ["VALID TILL", "EXPIRY", "EXP", "VALID UNTIL", "VALIDITY"]):
            match_exp = re.search(r'(\d{2}[/-]\d{2}[/-]\d{4})', line_upper)
            if not match_exp and idx + 1 < len(raw_text):
                match_exp = re.search(r'(\d{2}[/-]\d{2}[/-]\d{4})', raw_text[idx + 1])
            if match_exp:
                expiry_date = match_exp.group(1)

    # Fallback assignment for dates if contextual match didn't grab them
    if not dob and len(all_dates) >= 1:
        dob = all_dates[0]
    if not expiry_date and len(all_dates) >= 2:
        expiry_date = all_dates[1]

    # 3. Name Extraction
    for idx, line in enumerate(raw_text):
        line_upper = line.upper()
        if any(k in line_upper for k in ["NAME", "HOLDER", "NAME OF HOLDER"]) and not any(k in line_upper for k in ["FATHER", "MOTHER", "S/D/W"]):
            # Name might be on same line after colon/space or on next line
            after_colon = re.sub(r'.*NAME[:\s]*', '', line, flags=re.IGNORECASE).strip()
            if len(after_colon) > 2 and not any(char.isdigit() for char in after_colon):
                name_on_license = after_colon
                break
            elif idx + 1 < len(raw_text):
                next_line = raw_text[idx + 1].strip()
                if len(next_line) > 2 and not any(char.isdigit() for char in next_line) and not any(k in next_line.upper() for k in ["DOB", "DL", "ADDRESS", "FATHER"]):
                    name_on_license = next_line
                    break

    # Fallback name search: find prominent uppercase string line that is not a keyword or date or number
    if not name_on_license:
        skip_words = ["DRIVING", "LICENCE", "LICENSE", "UNION", "INDIA", "STATE", "TRANSPORT", "AUTHORITY", "FORM", "GOVERNMENT", "DOB", "VALID", "TILL", "ADDRESS"]
        for line in raw_text:
            clean_line = line.strip()
            if clean_line.isupper() and len(clean_line.split()) >= 2 and not any(char.isdigit() for char in clean_line):
                if not any(sw in clean_line for sw in skip_words):
                    name_on_license = clean_line
                    break

    # 4. Class of Vehicle (COV)
    cov_keywords = ["LMV", "MCWG", "MCWOG", "3WNT", "TRANS", "NON-TRANS", "COV", "CLASS"]
    found_covs = []
    for line in raw_text:
        line_upper = line.upper()
        for kw in ["LMV", "MCWG", "MCWOG", "TRANS", "NON-TRANS", "MOTORCYCLE", "CAR"]:
            if kw in line_upper and kw not in found_covs:
                found_covs.append(kw)
    if found_covs:
        cov = " / ".join(found_covs)
    else:
        cov = "LMV" # Default fallback for car driving license

    return {
        "success": True,
        "licenseNumber": license_number,
        "nameOnLicense": name_on_license,
        "dob": dob,
        "expiryDate": expiry_date,
        "cov": cov,
        "rawOcrText": raw_text
    }

def process_license(image_path):
    if not os.path.exists(image_path):
        return json.dumps({
            "success": False,
            "error": f"File not found at path: {image_path}"
        })

    try:
        from paddleocr import PaddleOCR
        # Initialize PaddleOCR with CPU compatibility flags
        try:
            ocr = PaddleOCR(use_angle_cls=True, lang='en', enable_mkldnn=False)
        except Exception:
            try:
                ocr = PaddleOCR(lang='en')
            except Exception:
                ocr = PaddleOCR()
        result = ocr.ocr(image_path)

        extracted_text_lines = []
        
        def extract_strings(obj):
            if isinstance(obj, str):
                if len(obj.strip()) > 0:
                    extracted_text_lines.append(obj.strip())
            elif isinstance(obj, dict):
                for k, v in obj.items():
                    if k in ['rec_text', 'text', 'transcription', 'words']:
                        if isinstance(v, str):
                            extracted_text_lines.append(v)
                        elif isinstance(v, list):
                            for item in v: extract_strings(item)
                    else:
                        extract_strings(v)
            elif isinstance(obj, (list, tuple)):
                # Standard paddleocr format: [[box, (text, score)], ...]
                if len(obj) == 2 and isinstance(obj[1], (list, tuple)) and len(obj[1]) >= 1 and isinstance(obj[1][0], str):
                    extracted_text_lines.append(obj[1][0])
                else:
                    for item in obj:
                        extract_strings(item)

        if result:
            extract_strings(result)

        parsed_data = parse_license_text(extracted_text_lines)
        return json.dumps(parsed_data, indent=2)

    except Exception as e:
        return json.dumps({
            "success": False,
            "error": f"PaddleOCR processing error: {str(e)}"
        })

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No image path provided"}))
        sys.exit(1)

    img_path = sys.argv[1]
    output_json = process_license(img_path)
    print(output_json)
