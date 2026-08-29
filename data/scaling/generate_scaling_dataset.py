from pathlib import Path
import sys

OUTPUT_DIR = Path("data/scaling/documents")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

if len(sys.argv) != 2:
    print("Usage: python generate_scaling_dataset.py <number_of_documents>")
    sys.exit(1)

num_documents = int(sys.argv[1])

if num_documents <= 0:
    print("Number of documents must be greater than 0.")
    sys.exit(1)

print(f"Generating {num_documents} documents...")

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

for i in range(1, num_documents + 1):

    document_id = f"DOC-{i:06d}"

    equipment = equipment_types[(i - 1) % len(equipment_types)]
    plant = plants[(i - 1) % len(plants)]
    finding = findings[(i - 1) % len(findings)]

    equipment_tag = f"{equipment.split()[0][:2].upper()}-{i:06d}"

    pressure = 8 + (i * 0.37)
    temperature = 60 + (i * 1.2)

    content = f"""Document ID: {document_id}
Equipment Tag: {equipment_tag}
Equipment: {equipment}
Plant: {plant}
Operating Pressure: {pressure:.1f} bar
Operating Temperature: {temperature:.1f} °C
Inspection Finding: {finding}

This inspection record documents the condition of {equipment}
with equipment tag {equipment_tag} at the {plant}.

During the inspection, technicians recorded an operating pressure
of {pressure:.1f} bar and an operating temperature of {temperature:.1f} °C.

The primary inspection finding was: {finding}.

The record should be reviewed by the responsible maintenance team.
"""

    output_file = OUTPUT_DIR / f"{document_id}.txt"
    output_file.write_text(content, encoding="utf-8")

print(f"Generated {num_documents} documents.")
print(f"Output directory: {OUTPUT_DIR}")
