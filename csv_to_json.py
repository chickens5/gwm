import csv
import glob
import json

import csv
import glob
import json
import os

# Define the folder containing your CSV files
input_folder = "csv_data"
output_folder = "json_files"

# Create the output directory if it doesn't exist
os.makedirs(output_folder, exist_ok=True)

# Find all .csv files in the directory
csv_files = glob.glob(os.path.join(input_folder, "*.csv"))

for file_path in csv_files:
    # Extract the base file name without the extension (e.g., "data")
    file_name = os.path.splitext(os.path.basename(file_path))[0]

    # Open and read the CSV file
    with open(file_path, mode="r", encoding="utf-8") as csv_file:
        # DictReader automatically uses the first row as dictionary keys
        csv_reader = csv.DictReader(csv_file)
        data_list = list(csv_reader)

    # Define the new JSON file path
    json_file_path = os.path.join(output_folder, f"{file_name}.json")

    # Write the data to a JSON file
    with open(json_file_path, mode="w", encoding="utf-8") as json_file:
        # indent=4 formats the JSON nicely; remove it for a smaller file size
        json.dump(data_list, json_file, indent=1)

    print(f"Successfully converted {file_path} -> {json_file_path}")
