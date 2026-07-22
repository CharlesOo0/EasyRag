"""
URL configuration for core project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include, re_path
from django.shortcuts import redirect

from django.conf import settings

def email_confirmation_redirect(request, key):
    return redirect(f"{settings.FRONTEND_URL}/auth/verify-email/{key}")

urlpatterns = [
    path('admin/', admin.site.urls),

    # Highest-priority redirect, matched at the root (more lenient regex)
    re_path(
        r'^api/registration/account-confirm-email/(?P<key>.+)/$',
        email_confirmation_redirect,
        name='account_confirm_email',
    ),

    # Not used directly by the SPA (the frontend talks to the /api/ endpoints
    # below), but allauth internally does `reverse('account_signup')` and
    # similar in a few code paths (e.g. its enumeration-prevention "someone
    # tried to sign up with your email" notification) - those named routes
    # must exist or allauth raises NoReverseMatch and 500s.
    path('accounts/', include('allauth.urls')),

    path('api/', include('apps.authentication.urls')),
]
