from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """
    Admin:
    - Create user
    - Update user
    - Delete user
    - View users
    """

    def has_permission(self, request, view):

        if not request.user.is_authenticated:
            return False

        if not request.user.groups.filter(name="Admin").exists():
            return False

        return request.method in ["GET", "POST", "PUT", "PATCH", "DELETE"]


class IsManager(BasePermission):
    """
    Manager:
    - Create employee
    - Update employee
    - View employees
    """

    def has_permission(self, request, view):

        if not request.user.is_authenticated:
            return False

        if not request.user.groups.filter(name="Manager").exists():
            return False

        return request.method in ["GET", "POST", "PUT", "PATCH"]


class IsEmployee(BasePermission):
    """
    Employee:
    - View own profile
    """

    def has_permission(self, request, view):

        if not request.user.is_authenticated:
            return False

        if not request.user.groups.filter(name="Employee").exists():
            return False

        return request.method == "GET"

    def has_object_permission(self, request, view, obj):

        return obj == request.user