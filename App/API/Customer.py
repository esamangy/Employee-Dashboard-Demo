from typing import Final
from flask import Blueprint, request, jsonify
import App.Database.DatabaseSession as dbs
from sqlalchemy import select
from flask_login import current_user, login_required

customers_bp = Blueprint("customers", __name__)
COMPANY_MAX_SEARCH_RESULTS: Final[int] = 50

@customers_bp.get("/api/customers")
@login_required
def GetCustomers():
    try:
        chars = request.args.get("chars", "").strip()
        with dbs.GetSession() as session:
            customers = session.query(dbs.Schema.Customer).where(
                dbs.Schema.Customer.name.ilike(f"%{chars}%")
            ).order_by(dbs.Schema.Customer.name.asc()).limit(COMPANY_MAX_SEARCH_RESULTS).all()

            return jsonify({"customers": [{
                "id": customer.id,
                "name": customer.name,
                "code": customer.code
            } for customer in customers ]
        }), 200
        return {"error": "No Database Session Active"}, 500
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"users": []}), 500
    
@customers_bp.get("/api/customers/<int:customer_id>")
@login_required
def GetCustomer(customer_id):
    customer = GetCustomerFromId(customer_id)
    if type(customer) is not dbs.Schema.Customer:
        return {"error": "Customer not found"}, 404
    
    return jsonify({"customer": {
        "id": customer.id,
        "name": customer.name,
        "code": customer.code
    }}), 200
    

def GetCustomerFromId(customer_id):
    try:
        with dbs.GetSession() as session:
            customer = session.query(dbs.Schema.Customer).where(
                dbs.Schema.Customer.id == customer_id,
            ).first()

            if customer is None:
                raise FileNotFoundError(f"Custom with id: {customer_id} cannot be found")
            return customer
        raise Exception("No database session Active")
    except Exception as e:
        print(f"Error: {e}")
