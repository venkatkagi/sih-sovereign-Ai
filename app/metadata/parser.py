def extract_metadata(text: str) -> dict:
    metadata = {}

    for line in text.splitlines():
        line = line.strip()

        if ":" not in line:
            continue

        key, value = line.split(":", 1)

        key = key.strip()
        value = value.strip()

        if key == "Document ID":
            metadata["document_id"] = value

        elif key == "Equipment Tag":
            metadata["equipment_tag"] = value

        elif key == "Equipment":
            metadata["equipment"] = value

        elif key == "Plant":
            metadata["plant"] = value

        elif key == "Department":
            metadata["department"] = value

        elif key == "Scheme":
            metadata["scheme"] = value

        elif key == "Reference Code":
            metadata["reference_code"] = value

        elif key == "Inspection Finding":
            metadata["finding"] = value

    return metadata
