from rest_framework import permissions

class IsAdministrator(permissions.BasePermission):
    """
    Grants access only to administrators.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_administrator)

class IsCustomer(permissions.BasePermission):
    """
    Grants access to customers.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_customer)
