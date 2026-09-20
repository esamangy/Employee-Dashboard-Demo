from datetime import datetime, date
from enum import StrEnum
import re
from flask import Blueprint, redirect, render_template, request, jsonify
from typing import Any, Final, Sequence
from flask_login import current_user, login_required
from sqlalchemy import ColumnElement, Date, Integer, and_, case, cast, func, or_, select
from App.API import JsonData
from App.API.Customer import GetCustomerFromId
from App.API.JsonData import GetJsonDataById, RequirePermissionForEditingJsonData
from App.API.User import CanAccessSalesManagerDashboard, GetCurrentUsersName, GetUsersInfo
from App.Database import Schema
import App.Database.DatabaseSession as dbs
from App.Custom import Version
from sqlalchemy.orm.attributes import flag_modified

sales_app_bp = Blueprint("sales_app", __name__)
ADDITIONAL_REPORTS_PER_PAGE: Final[int] = 10
SAVED_DATA_VERSION: Final[Version] = Version.FromString("0.0.1")

QUARTER_BUCKET_PATTERN = re.compile(r'^[1-4]\s(\d{4})$') # lookes like 1 2024 (quarter year)

class ManagerApprovalStatus(StrEnum):
    PENDING = "Pending"
    REJECTED = "Rejected"
    ACCEPTED = "Accepted"

@sales_app_bp.get("/SalesApp")
@login_required
def SalesApp():
    return redirect("/SalesApp/home")

@sales_app_bp.get("/SalesApp/<string:page>")
@login_required
def SalesAppPage(page: str):
    page = page.lower()
    match page:
        case "home":
            return render_template("Sales App/Home.html", title="Home", isManager=HasManagerAccess())
        case "recentlyviewed":
            return render_template("Sales App/Home.html", title="Recently Viewed", isManager=HasManagerAccess())
        case "myreports":
            return render_template("Sales App/Home.html", title="My Reports", isManager=HasManagerAccess())
        case "sharedwithme":
            return render_template("Sales App/Home.html", title="Shared With Me", isManager=HasManagerAccess())
        case "mydrafts":
            return render_template("Sales App/Home.html", title="My Drafts", isManager=HasManagerAccess())
        case _:
            return jsonify({"error": "Page not found"}), 404

#region Load More Reports

@sales_app_bp.get("/SalesApp/LoadMoreReports")
@login_required
def SalesAppLoadMoreReports():
    page = request.args.get("pageType", "")
    offset = int(request.args.get("offset", 0))
    match page:
        case "home":
            reports = GetReportsUserCanAccess(ADDITIONAL_REPORTS_PER_PAGE, offset)
        case "recentlyviewed":
            reports = GetRecentlyViewedReports(ADDITIONAL_REPORTS_PER_PAGE, offset)
        case "myreports":
            reports = GetUsersReports(ADDITIONAL_REPORTS_PER_PAGE, offset)
        case "sharedwithme":
            reports = GetReportsSharedWithUser(ADDITIONAL_REPORTS_PER_PAGE, offset)
        case "mydrafts":
            reports = GetUsersDrafts(ADDITIONAL_REPORTS_PER_PAGE, offset)
        case _:
            reports = []
    return jsonify({"reports": GetReportsMetaFromReports(reports), "has_more": len(reports) >= ADDITIONAL_REPORTS_PER_PAGE})

#region New Report

@sales_app_bp.route("/SalesApp/NewReport", methods=["GET"])
@login_required
def SalesAppNewReport() -> Any:
    today = date.today().isoformat()
    return render_template("Sales App/NewReport.html", today = today)

@sales_app_bp.route("/SalesApp/NewReport/<int:reportId>", methods=["GET"])
@login_required
def SalesAppNewReportWithId(reportId: int) -> Any:
    RequirePermissionForEditingJsonData(current_user.id, reportId)
    today = date.today().isoformat()
    return render_template("Sales App/NewReport.html", today = today, reportId = reportId)

@sales_app_bp.route("/SalesApp/NewReport/save-draft", methods=["POST"])
@login_required
def SalesAppNewReportSaveDraft() -> Any:
    data = request.get_json()
    return SaveReport(data = data, isDraft = True, meta = data.get("meta"))

@sales_app_bp.route("/SalesApp/NewReport/save-draft/<int:report_id>", methods=["POST"])
@login_required
def SalesAppNewReportSaveDraftWithId(report_id: int) -> Any:
    data = request.get_json()
    return SaveReport(data = data, isDraft = True, report_id = report_id, meta = data.get("meta"))

@sales_app_bp.route("/SalesApp/NewReport/save-final", methods=["POST"])
@login_required
def SalesAppNewReportSaveFinal() -> Any:
    data = request.get_json()
    return SaveReport(data = data, isDraft = False, meta = data.get("meta"))

@sales_app_bp.route("/SalesApp/NewReport/save-final/<int:report_id>", methods=["POST"])
@login_required
def SalesAppNewReportSaveFinalWithId(report_id: int) -> Any:
    data = request.get_json()
    return SaveReport(data = data, isDraft = False, report_id = report_id, meta = data.get("meta"))

#endregion
#region Report Overview

@sales_app_bp.route("/SalesApp/ReportOverview/<int:report_id>")
@login_required
def SalesAppReportOverview(report_id: int):
    JsonData.RequirePermissionForViewingJsonData(current_user.id, report_id) # check if the user has permission to view this report
    JsonData.UpdateLastOpenedAt(report_id, current_user.id)

    report = GetJsonDataById(report_id, False)
    reportTitle = report.title
    owner_id = report.owner_id

    canEdit = owner_id == current_user.id and report.meta_data.get("Manager_Approval") != ManagerApprovalStatus.ACCEPTED.value
    return render_template("Sales App/ReportOverview.html", reportTitle=reportTitle, canEdit=canEdit, isShared = owner_id != current_user.id)

@sales_app_bp.get("/SalesApp/ReportOverview/data/<int:report_id>")
@login_required
def GetReportDataForOverview(report_id: int):
    report = GetJsonDataById(report_id, False)
    reportData = report.data
    reportTitle = report.title
    owner_id = report.owner_id
    meta = report.meta_data

    reportData = ConvertFormDataToOrganizedDict(reportData)
    return jsonify({"report": reportData, "reportId": report_id, "reportTitle": reportTitle, "isShared": owner_id != current_user.id, "owner": GetUsersInfo(owner_id), "meta": meta}), 200

#region Helper Functions

def GetReportsUserCanAccess(num_reports:int, offset:int):
    with dbs.GetSession() as session:
        rows = session.query(dbs.Schema.Json_Data).outerjoin( # join with permissions. outer join to include reports without permissions
            dbs.Schema.Json_Data_Permission, # table to join
            dbs.Schema.Json_Data.id == dbs.Schema.Json_Data_Permission.json_data_id #what columns are used to match rows
        ).filter(or_( #filter results
            dbs.Schema.Json_Data.owner_id == current_user.id, #what report belongs to the current user
            dbs.Schema.Json_Data_Permission.granted_to_id == current_user.id #what reports are shared with the current user
        )).distinct().order_by( #sort the list
            dbs.Schema.Json_Data.updated_at.desc() #sort by last viewed date
        ).offset(offset).limit(num_reports).all()
        return rows
    raise Exception("No Database Session Active")

def GetRecentlyViewedReports(num_reports: int, offset: int):
    with dbs.GetSession() as session:
        return session.query(dbs.Schema.Json_Data).outerjoin( # join with permissions. outer join to include reports without permissions
            dbs.Schema.Json_Data_Permission, # table to join
            dbs.Schema.Json_Data.id == dbs.Schema.Json_Data_Permission.json_data_id #what columns are used to match rows
        ).join( # join with user activity. join to exlude any reports that the user hasn't viewed
            dbs.Schema.User_Json_Data_Activity, and_( #table to join
                dbs.Schema.Json_Data.id == dbs.Schema.User_Json_Data_Activity.json_data_id, #what columns are used to match rows
                dbs.Schema.User_Json_Data_Activity.user_id == current_user.id 
            ),
        ).filter(or_( #filter results
            dbs.Schema.Json_Data.owner_id == current_user.id, #what report belongs to the current user
            dbs.Schema.Json_Data_Permission.granted_to_id == current_user.id #what reports are shared with the current user
        )).order_by( #sort the list
            dbs.Schema.User_Json_Data_Activity.last_viewed_at.desc() #sort by last viewed date
        ).offset(offset).limit(num_reports).all()
    raise Exception("No Database Session Active")

def GetUsersReports(num_reports: int, offset: int):
    with dbs.GetSession() as session:
        return session.query(dbs.Schema.Json_Data).filter(
                dbs.Schema.Json_Data.owner_id == current_user.id,
                dbs.Schema.Json_Data.data_type_id.in_(dbs.GetDataTypeIdsByName("sales_app_report", "sales_app_report_draft"))
            ).order_by(dbs.Schema.Json_Data.updated_at.desc().nullslast()).offset(offset).limit(num_reports).all()
    raise Exception("No Database Session Active")

def GetReportsSharedWithUser(num_reports: int, offset: int):
    with dbs.GetSession() as session:
        return session.query(dbs.Schema.Json_Data).join(
                dbs.Schema.Json_Data_Permission, dbs.Schema.Json_Data.id == dbs.Schema.Json_Data_Permission.json_data_id
            ).filter(
                dbs.Schema.Json_Data_Permission.granted_to_id == current_user.id
            ).order_by(dbs.Schema.Json_Data.updated_at.desc().nullslast()).offset(offset).limit(num_reports).all()
    raise Exception("No Database Session Active")

def GetUsersDrafts(num_reports: int, offset: int):
    with dbs.GetSession() as session:
        return session.query(dbs.Schema.Json_Data).filter(
                dbs.Schema.Json_Data.owner_id == current_user.id,
                dbs.Schema.Json_Data.data_type_id.in_(dbs.GetDataTypeIdsByName("sales_app_report_draft"))
            ).order_by(dbs.Schema.Json_Data.updated_at.desc().nullslast()).offset(offset).limit(num_reports).all()
    raise Exception("No Database Session Active")

def GetReportsMetaFromReports(reports: Sequence[Any]) -> list[dict[str, Any]]:
    reportsList = [
        {
            "title": report.title,
            "date_visited": report.data.get("date_visited", "N/A"),
            "last_edited": report.updated_at.strftime("%m-%d-%Y"),
            "id": report.id,
            "warning": GetReportsWarningMessage(report),
            "isShared": report.owner_id != current_user.id
        } for report in reports
    ]
    return reportsList

def GetReportsWarningMessage(report) -> str:
    if report.data_type_id == dbs.GetDataTypeIdByName("sales_app_report_draft"):
        return "(Draft)"
    
    if GetReportApprovalStatus(report) == ManagerApprovalStatus.REJECTED:
        return "(Rejected)"
    
    return ""

def SaveReport(data, isDraft, report_id = None, meta = None,):
    formData = data["form"]
    with dbs.GetSession() as session:
        try:
            dataTypeId = dbs.GetDataTypeIdByName("sales_app_report_draft" if isDraft else "sales_app_report")
        except Exception as e:
            print(e)
            return {"error": str(e)}, 500

        #change the display mode for the date visited in the report.
        date_string = formData.get("date_visited", "")
        formData["date_visited"] = ConvertYMDToMDY(date_string)
        meta = meta or {}
        meta.update({"Version": str(SAVED_DATA_VERSION)})

        if(report_id is None or report_id < 0):
            new_report_id = JsonData.InsertJsonData(data_type_id = dataTypeId, data = formData, title = GenerateDefaultReportTitle(formData), meta = meta)
            JsonData.UpdateLastOpenedAt(new_report_id, current_user.id)
            return jsonify({"message": "Report inserted successfully",
                            "report_id": new_report_id}), 200
        else:
            row = session.query(dbs.Schema.Json_Data).filter_by(id = report_id, owner_id = current_user.id).first()
            if row is None:
                return {"error": "Report not found"}, 404
            row.data = formData
            row.data_type_id = dataTypeId
            row.updated_at = func.now()
            if row.meta_data is None:
                row.meta_data = meta

            if(data["submitted"]):
                meta = dict(row.meta_data)
                meta.pop("Reject_Reasons", None)
                meta["Manager_Approval"] = ManagerApprovalStatus.PENDING.value

                row.meta_data = meta
            if not row.renamed:
                row.title = GenerateDefaultReportTitle(formData)
            session.commit()
            session.refresh(row)
            return jsonify({"message": "Report updated successfully",
                            "report_id": row.id}), 200
    return {"error": "No Database Session Active"}, 500

def ConvertYMDToMDY(date_string: str) -> str:
    try:
        date = datetime.strptime(date_string, "%Y-%m-%d").date()
        return date.strftime("%m-%d-%Y")
    except ValueError:
        return date_string

def GenerateDefaultReportTitle(formData:dict) -> str:
    # update to get users name instead of hardcoded name
    customerInfo = GetCustomerFromId(int(formData.get("customer_visited_id", -1)))
    return GetCurrentUsersName() + "'s visit to " + (customerInfo.name if customerInfo is not None else "Unknown Customer") + " on " + ConvertYMDToMDY(formData.get("date_visited", "Unknown Date"))

def GetMetaData(data:dict) -> dict[str, Any]:
    return {"saved_data_version": "1.0"}

def GetConnectedDataSorted(formData, group:str) -> dict[int, dict[str, str]]:
    connectedData:dict[str, str] = {
        key: value
        for key, value in formData.items()
        if group in key
    }
    final:dict[int, dict[str, str]] = {}
    for key, value in connectedData.items():
        try:
            index:int = int(key[-1])
        except :
            continue

        key:str = key[len(group) + 1: -2] # remove prefix and index to get key
        if(index not in final) :
            final[index] = {}
        final[index][key] = value
    return final
        

def ConvertFormDataToOrganizedDict(formData:dict) -> dict:
    organizedData:dict[str, Any] = {}
    customerInfo = GetCustomerFromId(int(formData.get("customer_visited_id", -1)))
    organizedData["general_information"] = {
        "customer_visited": customerInfo.name if customerInfo is not None else "",
        "date_visited": formData.get("date_visited", ""),
        "a_additional_coworkers": [coworker.strip() for coworker in formData.get("additional_coworkers", "").split(",")],
    }
    organizedData["pre-visit_preparation"] = {
        "c_preperation_completed": {
            "account_researched": True if "account_researched" in formData else False,
            "agenda_prepared": True if "agenda_prepared" in formData else False,
            "samples_/_literature_prepared": True if "samples_/_literature_prepared" in formData else False,
            "competitive_intelligence_gathered": True if "competitive_intelligence_gathered" in formData else False,
            "lead_time_sheet_updated": True if "lead_time_sheet_updated" in formData else False,
            "customer_history_reviewed": True if "customer_history_reviewed" in formData else False,
        }
    }
    organizedData["contacts"] = {
        "l_decision_makers": GetConnectedDataSorted(formData, "contacts")
    }
    organizedData["discussion_summary"] = {
        "products_discussed": formData.get("products_discussed", ""),
        "programs_discussed": formData.get("programs_discussed", ""),
        "discussion_topics": formData.get("discussion_topics", ""),
    }
    organizedData["customer_goals_and_pain_points"] = {
        "c_concerns_informed_of": {
            "lead_time_concerns": True if "lead_time_concerns" in formData else False,
            "pricing_concerns": True if "pricing" in formData else False,
            "warranty_issues": True if "warranty" in formData else False,
            "delivery_or_logistics_issues": True if "logistics_concerns" in formData else False,
            "quality_concerns": True if "quality_pain_points" in formData else False,
            "need_for_training_or_product_knowledge": True if "knowledge" in formData else False,
            "stocking_shortages": True if "stocking_shortages" in formData else False,
            "competitor_presence": True if "competitor_presence" in formData else False,
            "s_other_pain_points": formData.get("other_pain_points", ""),
        },
        "addressed_issues": formData.get("addressed_issues", ""),
        "addressed_issues_explanation": formData.get("addressed_issues_explanation", "")
    }
    organizedData["site_observations"] = {
        "service_capabilities": formData.get("service_capabilities", ""),
        "inventory_findings": formData.get("inventory_findings", ""),
        "c_competitors_mentioned": {
            "muncie": True if "muncie" in formData else False,
            "heavy_motions": True if "heavy_motions" in formData else False,
            "parker": True if "parker" in formData else False,
            "s_other_competitor": formData.get("other_competitor", ""),
        },
    }
    organizedData["new_opportunities"] = {
        "c_opportunities_identified": {
            "new_business": True if "new_business" in formData else False,
            "cross-reference_opportunity": True if "cross_reference" in formData else False,
            "new_product_line_expansion": True if "expansion" in formData else False,
            "stocking_/_consignment": True if "stocking_consignment" in formData else False,
            "training_opportunity": True if "training_opportunity" in formData else False,
            "engineering_/_project_collaboration": True if "collaboration" in formData else False,
            "referral_received": True if "referral_received" in formData else False,
            "program_participation": True if "program_participation" in formData else False,
            "s_other_opportunities": formData.get("other_opportunities", ""),
        },
        "l_referrals": GetConnectedDataSorted(formData, "referrals")
    }
    organizedData["orders"] = {
        "secured_order": formData.get("secured_order", ""),
        "quote": formData.get("quote", ""),
        "product_series": formData.get("products_ordered", ""),
        "c_reasons_for_not_ordering": {
            "lead_time": True if "lead_time_orders" in formData else False,
            "price": True if "price_orders" in formData else False,
            "quality": True if "quality_orders" in formData else False,
            "lost_to_a_competitor": True if "lost_to_competitor_orders" in formData else False,
            "budget_or_timing": True if "budget_timing_orders" in formData else False,
            "low_demand": True if "low_demand_orders" in formData else False,
        },
    }
    organizedData["training_and_development"] = {
        "training_requested": formData.get("training_requested", ""),
        "c_training_types_requested": {
            "permco_school": True if "permco_school_td" in formData else False,
            "virtual": True if "virtual_training_td" in formData else False,
            "branch": True if "branch_training_td" in formData else False,
            "s_other_training_requested": formData.get("other_training_requested", ""),
        },
        "discussed_permco_school": formData.get("discussed_permco_school", "")
    }
    organizedData["sentiment_and_relationship_feedback"] = {
        "customer_feedback": formData.get("customer_feedback", ""),
        "relationship_status": formData.get("relationship_status", "")
    }
    return organizedData

#endregion
#region Manager

@sales_app_bp.get("/SalesApp/manager_dashboard")
@login_required
def SalesAppManager():
    if HasManagerAccess():
        return render_template("Sales App/ManagerDashboard.html", title="Manager Dashboard")
    else:
        return "You do not have permission to view this page", 401
    
@sales_app_bp.get("/SalesApp/manager_dashboard/<int:report_id>")
@login_required
def SalesAppManagerReport(report_id: int):
    if HasManagerAccess():
        report = GetJsonDataById(report_id, True)
        reportData = report.data
        reportTitle = report.title
        owner_id = report.owner_id
        meta = report.meta_data
        return render_template("Sales App/ManagerDashboard.html", title="Manager Dashboard", reportData=reportData, reportTitle=reportTitle, owner_id=owner_id, meta=meta)
    else:
        return "You do not have permission to view this page", 401
    
@sales_app_bp.get("/SalesApp/manager_dashboard/buckets")
@login_required
def GetReportListBucket():
    if not HasManagerAccess():
        return "You do not have permission", 401
    
    bucketCategory = request.args.get("bucketType", "")

    if bucketCategory == "":
        return jsonify({"error": "Bucket Category not defined"}), 404
    if len(bucketCategory) != 2:
        return jsonify({"error": "Bucket Category does not follow accepted system"}), 400
    
    offset = int(request.args.get("offset", ""))
    if offset is None:
        return jsonify({"error": "offset not defined"}), 404

    buckets = GetReportBuckets(bucketCategory, offset)
    return jsonify({"buckets": buckets, "hasMore": len(buckets) >= ADDITIONAL_REPORTS_PER_PAGE})

@sales_app_bp.get("/SalesApp/manager_dashboard/bucket/reports")
@login_required
def GetReportsForBucketManager():
    if not HasManagerAccess():
        return "You do not have permission", 401
    
    bucket = request.args.get("bucket", None)
    if bucket is None:
        return jsonify({"error": "Bucket not defined"}), 404
    
    sortOrder = request.args.get("sortOrder", None)
    if sortOrder is None:
        return jsonify({"error": "Sort method not defined"}), 404
    
    offset = request.args.get("offset", None)
    if offset is None:
        return jsonify({"error": "offset not defined"}), 404
    
    reports = GetReportsForBucket(bucket, sortOrder, offset)
    return jsonify({"reports": reports, "hasMore": len(reports) >= ADDITIONAL_REPORTS_PER_PAGE})

@sales_app_bp.patch("/SalesApp/manager_dashboard/report/<int:report_id>/approve")
@login_required
def ApproveReportManager(report_id: int):
    if not HasManagerAccess():
        return "You do not have permission", 401
    
    try:
        with dbs.GetSession() as session:
            json_data = session.query(Schema.Json_Data).filter_by(id = report_id).first()

            if json_data is None:
                raise FileNotFoundError(f"No JSON data found with id {report_id} and owner id {current_user.id}")

            try:
                json_data.meta_data["Manager_Approval"] = ManagerApprovalStatus.ACCEPTED.value
                flag_modified(json_data, "meta_data")
                json_data.updated_at = func.now()
                session.commit()
            except Exception as e:
                session.rollback()
                print(f"Error: {e}")
            return jsonify({"message": "Report approved successfully", "report": GetReportsMetaForManager([GetJsonDataById(report_id, True)])[0]}), 200
        raise Exception("No Database Session Active. Failed to update last opened at.")
    except Exception as e:
        print(f"Error approving report {report_id}: {e}")
        return jsonify({"error": str(e)}), 500


@sales_app_bp.patch("/SalesApp/manager_dashboard/report/<int:report_id>/reject")
@login_required
def RejectReportManager(report_id: int):
    if not HasManagerAccess():
        return "You do not have permission", 401
    
    try:
        data = request.get_json()
        with dbs.GetSession() as session:
            json_data = session.query(Schema.Json_Data).filter_by(id = report_id).first()

            if json_data is None:
                raise FileNotFoundError(f"No JSON data found with id {report_id} and owner id {current_user.id}")

            try:
                json_data.meta_data["Manager_Approval"] = ManagerApprovalStatus.REJECTED.value
                json_data.meta_data["Reject_Reasons"] = data
                flag_modified(json_data, "meta_data")
                json_data.updated_at = func.now()
                session.commit()
            except Exception as e:
                session.rollback()
                print(f"Error: {e}")
            return jsonify({"message": "Report approved successfully", "report": GetReportsMetaForManager([GetJsonDataById(report_id, True)])[0]}), 200
        raise Exception("No Database Session Active. Failed to update last opened at.")
    except Exception as e:
        print(f"Error approving report {report_id}: {e}")
        return jsonify({"error": str(e)}), 500
    
# region Manager Helper

def HasManagerAccess() -> bool:
    return CanAccessSalesManagerDashboard()

def GetReportBuckets(bucketCategory:str, offset:int):
    if bucketCategory.startswith("q"):
        return GetBucketsMeta(GetQuarterBuckets(bucketCategory[1], offset), "q",)
    elif bucketCategory.startswith("e"):
        return GetBucketsMeta(GetEmployeeBuckets(bucketCategory[1], offset), "e")
    else:
        raise ValueError("Bucket category not accepted")

def GetReportsForBucket(bucket, sortOrder, offset):
    if QUARTER_BUCKET_PATTERN.match(bucket):
        return GetReportsMetaForManager(GetReportsForQuarter(bucket, sortOrder, offset))
    elif bucket.isdigit():
        userId = int(bucket)
        return GetReportsMetaForManager(GetReportsForEmployee(userId, sortOrder, offset))
    else:
        raise ValueError("bucket identification not accepted")

def GetBucketsMeta(buckets, bucketType: str):
    if(bucketType == "q"):
        return [
            {
                "label": f"Q{((bucket.month - 1) // 3) + 1} {bucket.year}",
                "group": f"{((bucket.month - 1) // 3) + 1} {bucket.year}"
            }
            for bucket in (
                datetime.strptime(bucket, "%Y-%m-%d").date()
                if isinstance(bucket, str)
                else bucket
                for bucket in buckets
            )
        ]
    elif(bucketType == "e"):
        return [
            {"label": f"{bucket[1]}, {bucket[0]}", "group": bucket[2]}
            for bucket in buckets
        ]

def GetReportsMetaForManager(reports):
    return [
            {
                "id": report.id,
                "title": report.title,
                "date_visited": report.data.get("date_visited"),
                "status": GetReportApprovalStatus(report).value,
            }
            for report in reports
        ]

def GetReportApprovalStatus(report) -> ManagerApprovalStatus:
    if not report.meta_data.get("Manager_Approval"):
        return ManagerApprovalStatus.PENDING
    
    status = report.meta_data.get("Manager_Approval")
    if status in ManagerApprovalStatus._value2member_map_:
        return ManagerApprovalStatus(status)
    
    raise ValueError("Manager status is not an accepted value")

def GetReportsForEmployee(userId, sortOrder, offset):
    order = GetSortOrder(sortOrder)

    with dbs.GetSession() as session:
        return session.query(dbs.Schema.Json_Data).filter(
                dbs.Schema.Json_Data.owner_id == userId,
                dbs.Schema.Json_Data.data_type_id.in_(dbs.GetDataTypeIdsByName("sales_app_report"))
            ).order_by(*order).offset(offset).limit(ADDITIONAL_REPORTS_PER_PAGE).all()
    raise Exception("No Database Session Active")

def GetReportsForQuarter(quarter, sortOrder, offset):
    desiredQuarter = GetQuarterFromBucket(quarter)
    if dbs.db_provider.engine.dialect.name == "sqlite":
        dateVisited = dbs.Schema.Json_Data.data["date_visited"].as_string()

        month = cast(
            func.substr(dateVisited, 1, 2),
            Integer
        )

        year = func.substr(dateVisited, 7, 4)

        quarterStartMonth = (
            ((month - 1) / 3).cast(Integer) * 3 + 1
        )

        quarterVisited = func.date(
            year + "-01-01",
            func.printf("+%d months", quarterStartMonth - 1)
        )

        # SQLite returns func.date() as a string
        desiredQuarter = desiredQuarter.isoformat()

    else:
        quarterVisited = func.date_trunc(
            "quarter",
            cast(
                dbs.Schema.Json_Data.data["date_visited"].astext,
                Date
            )
        )
    
    order = GetSortOrder(sortOrder)
    
    with dbs.GetSession() as session:
        reports = session.query(dbs.Schema.Json_Data).outerjoin(
            dbs.Schema.User,
            dbs.Schema.Json_Data.owner_id == dbs.Schema.User.id
            ).where(
                quarterVisited == desiredQuarter,
                dbs.Schema.Json_Data.data_type_id.in_(dbs.GetDataTypeIdsByName("sales_app_report"))
            ).order_by(*order).offset(offset).limit(ADDITIONAL_REPORTS_PER_PAGE).all()
        return reports
    raise Exception("No Database Session Active")

def GetSortOrder(sortOrder) -> tuple[ColumnElement, ...]:
    user = dbs.Schema.User
    if dbs.db_provider.engine.dialect.name == "sqlite":
        dateVisitedJson = dbs.Schema.Json_Data.data["date_visited"]
        dateOfVisit = func.date(
            func.substr(dateVisitedJson.as_string(), 7, 4),
            func.substr(dateVisitedJson.as_string(), 1, 2),
            func.substr(dateVisitedJson.as_string(), 4, 2)
        )
    else:
        dateOfVisit = cast(dbs.Schema.Json_Data.data["date_visited"].astext, Date)
    
    match(sortOrder):
        case "ea":
            return (user.last_name.asc(), user.first_name.desc())
        case "ez":
            return (user.last_name.desc(), user.first_name.desc())
        case "ms":
            if dbs.db_provider.engine.dialect.name == "sqlite":
                approvalValue = dbs.Schema.Json_Data.meta_data["Manager_Approval"].as_string()
            else:
                approvalValue = dbs.Schema.Json_Data.meta_data["Manager_Approval"].astext
            approval_order = case(
                (approvalValue == ManagerApprovalStatus.REJECTED.value, 1),
                (approvalValue == ManagerApprovalStatus.ACCEPTED.value, 2),
                else_ = 0
            )
            return (approval_order.asc(), cast(dateOfVisit, Date).desc())
        case "ql":
            return (dateOfVisit.desc(),)
        case "qo":
            return (dateOfVisit.asc(),)
        case _:
            return ()         

def GetQuarterFromBucket(bucket:str) -> date:
    quarter_str, year_str = bucket.split()

    quarter = int(quarter_str)
    year = int(year_str)

    month = (quarter - 1) * 3 + 1
    return date(year, month, 1)

def GetQuarterBuckets(sortOrder: str, offset:int):
    quarter = GetQuarterExpression(dbs.Schema.Json_Data.data["date_visited"])
    order = quarter.desc() if sortOrder == "n" else quarter.asc()

    with dbs.GetSession() as session:
        dates = session.scalars(select(quarter).where(
                dbs.Schema.Json_Data.data_type_id.in_(dbs.GetDataTypeIdsByName("sales_app_report"))
            ).distinct().order_by(order).offset(offset).limit(ADDITIONAL_REPORTS_PER_PAGE)
        ).all()
        return dates
    raise Exception("No Database Session Active")

def GetEmployeeBuckets(sortOrder: str, offset:int):
    user = dbs.Schema.User
    order = (user.last_name.asc(), user.first_name.desc()) if sortOrder == "a" else (user.last_name.desc(), user.first_name.desc())

    with dbs.GetSession() as session:
        employees = session.query(user.first_name, user.last_name, user.id).join(
            dbs.Schema.Json_Data,
            dbs.Schema.Json_Data.owner_id == dbs.Schema.User.id
            ).where(
                dbs.Schema.Json_Data.data_type_id.in_(dbs.GetDataTypeIdsByName("sales_app_report"))
            ).distinct().order_by(*order).offset(offset).limit(ADDITIONAL_REPORTS_PER_PAGE).all()
        return employees
    raise Exception("No Database Session Active")

def GetQuarterExpression(obj):
    if dbs.db_provider.engine.dialect.name == "sqlite":
        # SQLite-specific expression
        dateOfVisit = obj.as_string()

        month = cast(
            func.substr(dateOfVisit, 1, 2),
            Integer
        )

        year = func.substr(dateOfVisit, 7, 4)

        quarterStartMonth = (
            ((month - 1) / 3).cast(Integer) * 3 + 1
        )

        quarter = func.date(
            year + "-01-01",
            func.printf("+%d months", quarterStartMonth - 1)
        ).label("quarter_start")
        return quarter
    else:
        # PostgreSQL-specific expression
        dateOfVisit = cast(obj.astext, Date)
        return func.date_trunc("quarter", dateOfVisit).label("quarter_start")