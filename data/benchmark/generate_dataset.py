from pathlib import Path
import json


# --------------------------------------------------
# Configuration
# --------------------------------------------------

OUTPUT_DIR = Path("data/benchmark/documents")
QUESTIONS_FILE = Path("data/benchmark/questions.json")

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


# --------------------------------------------------
# Benchmark data
# --------------------------------------------------

equipment_types = [
    "Centrifugal Pump",
    "Compressor",
    "Heat Exchanger",
    "Boiler",
    "Cooling Tower",
    "Pressure Vessel",
    "Control Valve",
    "Air Receiver",
    "Gas Turbine",
    "Diesel Generator",
]

plants = [
    "Chennai Refinery",
    "Madurai Facility",
    "Coimbatore Plant",
    "Salem Processing Unit",
    "Trichy Power Station",
    "Erode Chemical Plant",
    "Vellore Manufacturing Unit",
    "Tirunelveli Terminal",
    "Thanjavur Processing Plant",
    "Dindigul Utility Station",
]

findings = [
    "seal leakage detected during inspection",
    "excessive vibration observed in the rotating assembly",
    "abnormal temperature rise detected",
    "pressure fluctuation observed during operation",
    "corrosion found near the inlet connection",
    "bearing wear detected",
    "coolant leakage observed",
    "electrical insulation degradation detected",
    "unusual noise detected during operation",
    "no significant abnormality found",
]


# --------------------------------------------------
# Generate 100 documents
# --------------------------------------------------

for i in range(1, 101):

    document_id = f"DOC-{i:04d}"

    equipment = equipment_types[(i - 1) % len(equipment_types)]
    plant = plants[(i - 1) % len(plants)]
    finding = findings[(i - 1) % len(findings)]

    pressure = 8 + (i * 0.37)
    temperature = 60 + (i * 1.2)

    month = ((i - 1) % 12) + 1
    day = ((i - 1) % 28) + 1

    inspection_date = f"2026-{month:02d}-{day:02d}"

    # Unique equipment tag for every document.
    # Example: CE-005, CO-012, HE-023
    equipment_tag = f"{equipment.split()[0][:2].upper()}-{i:03d}"

    content = f"""Document ID: {document_id}
Equipment Tag: {equipment_tag}
Equipment: {equipment}
Plant: {plant}
Operating Pressure: {pressure:.1f} bar
Operating Temperature: {temperature:.1f} °C
Inspection Date: {inspection_date}
Inspection Finding: {finding}

This inspection record documents the condition of {equipment}
with equipment tag {equipment_tag} at the {plant}.

During the inspection, technicians recorded an operating pressure
of {pressure:.1f} bar and an operating temperature of {temperature:.1f} °C.

The primary inspection finding was: {finding}.

The record should be reviewed by the responsible maintenance team.
"""

    output_file = OUTPUT_DIR / f"{document_id}.txt"

    output_file.write_text(
        content,
        encoding="utf-8",
    )


# --------------------------------------------------
# Generate ground-truth benchmark questions
# --------------------------------------------------

test_ids = [
    5,
    12,
    23,
    34,
    45,
    56,
    67,
    78,
    89,
    100,
]

questions = []

for doc_number in test_ids:

    document_id = f"DOC-{doc_number:04d}"

    equipment = equipment_types[
        (doc_number - 1) % len(equipment_types)
    ]

    plant = plants[
        (doc_number - 1) % len(plants)
    ]

    finding = findings[
        (doc_number - 1) % len(findings)
    ]

    equipment_tag = (
        f"{equipment.split()[0][:2].upper()}-{doc_number:03d}"
    )

    question = {
        "question": (
            f"What inspection finding was reported for "
            f"equipment {equipment_tag} at the {plant}?"
        ),
        "expected_document": f"{document_id}.txt",
        "expected_finding": finding,
    }

    questions.append(question)


# --------------------------------------------------
# Save benchmark questions
# --------------------------------------------------

QUESTIONS_FILE.write_text(
    json.dumps(
        questions,
        indent=2,
        ensure_ascii=False,
    ),
    encoding="utf-8",
)


# --------------------------------------------------
# Completion message
# --------------------------------------------------

print("Generated 100 benchmark documents.")
print(f"Generated {len(questions)} test questions.")
print(f"Documents directory: {OUTPUT_DIR}")
print(f"Questions file: {QUESTIONS_FILE}")
