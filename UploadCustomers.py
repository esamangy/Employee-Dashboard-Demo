import csv
import re
import App.Database.DatabaseSession as dbs
from sqlalchemy import text

csvPath: str = "C:/Users/Developer4/Desktop/Customers.csv"
cleanStart: bool = True
CODE_PATTERN = re.compile(r"[A-Za-z&]{3}\*[A-Za-z&]{3}")

def ShouldImportRow(code: str, name:str) -> bool:
    if not code or not name:
        return False
    if code.lower() == "customer" or name.lower() == "customer name":
        return False
    if not CODE_PATTERN.fullmatch(code):
        return False
    return True

def CleanRow(code: str, name:str) -> tuple[str, str]:
    cleanCode = code
    cleanName = CleanName(name)

    return cleanCode, cleanName

def CleanName(name:str) -> str:
    return " ".join(word.capitalize() for word in name.lower().split())
    

def ImportCsv(path: str) -> dict[str, int] | None:
    inserted = 0
    skipped = 0
    failed = 0

    objectsToInsert: list[dbs.Schema.Customer] = []

    with open(path, "r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)

        requiredColumns = {"Customer", "Customer Name"}

        actualColumns = set(reader.fieldnames or [])
        missingColumns = requiredColumns - actualColumns

        if missingColumns:
            raise ValueError(
                f"CSV is missing columns: {', '.join(sorted(missingColumns))}"
            )
        
        for rowNum, row in enumerate(reader, start=2):
            try:
                code = row["Customer"].strip()
                name = row["Customer Name"].strip()

                code, name = CleanRow(code, name)

                if not ShouldImportRow(code, name):
                    skipped += 1
                    continue

                objectsToInsert.append(dbs.Schema.Customer(
                    name = name,
                    code = code
                ))

            except (ValueError, TypeError, KeyError) as error:
                failed += 1
                print(f"Skipping CSV row {rowNum}: {error}")

    with dbs.GetSession() as session:        
        try:
            session.add_all(objectsToInsert)
            session.commit()
            inserted = len(objectsToInsert)

        except Exception:
            session.rollback()
            raise

    return {
        "inserted": inserted,
        "skipped": skipped,
        "failed": failed,
    }

if __name__ == "__main__":
    if cleanStart:
        with dbs.GetSession() as session:
            session.execute(text("TRUNCATE TABLE customers RESTART IDENTITY CASCADE"))
            session.commit()
    print(ImportCsv(csvPath))