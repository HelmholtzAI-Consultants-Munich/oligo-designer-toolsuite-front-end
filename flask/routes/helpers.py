def to_bool(val):
    return True if str(val).lower() == 'true' else False

def to_int(val):
    try:
        return int(val)
    except ValueError:
        return val

def to_null(val):
    return None if val == "" or str(val).lower() == "null" else val

def multiline_to_list(val):
    lines = [line.strip() for line in val.split('\n') if line.strip()]
    return lines

def split_on_newline(s):
    if '\n' in s:
        result = []
        parts = s.split('\n')
        for i, part in enumerate(parts):
            if i > 0:
                result.append('\n')
            result.append(part)
        return result
    else:
        return [s]