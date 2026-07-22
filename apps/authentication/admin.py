from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    model = User
    list_display = ['email', 'username', 'language', 'is_customer', 'is_administrator', 'is_staff']
    fieldsets = UserAdmin.fieldsets + (
        (None, {'fields': ('language', 'is_customer', 'is_administrator')}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        (None, {'fields': ('language', 'is_customer', 'is_administrator')}),
    )
