from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core import exceptions
from django.utils.translation import gettext as _
from rest_framework import serializers
from dj_rest_auth.registration.serializers import RegisterSerializer as DefaultRegisterSerializer
from dj_rest_auth.serializers import (
    LoginSerializer as DefaultLoginSerializer,
    PasswordResetSerializer as DefaultPasswordResetSerializer,
)
from allauth.account.utils import user_pk_to_url_str

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'language', 'is_customer', 'is_administrator')
        # Role flags and email must never be settable by the user themselves -
        # if this serializer is ever wired in as USER_DETAILS_SERIALIZER for
        # profile editing, a plain ModelSerializer would otherwise let anyone
        # PATCH their own is_administrator to True.
        read_only_fields = ('email', 'is_customer', 'is_administrator')

class LoginSerializer(DefaultLoginSerializer):
    """
    Wraps dj-rest-auth's "email not verified" error with a stable machine
    code, since the base serializer only raises a translated free-text
    message - the frontend can't reliably match that once Accept-Language
    isn't English (see authentication error handling in login.tsx).
    """
    def validate(self, attrs):
        try:
            return super().validate(attrs)
        except serializers.ValidationError as exc:
            detail = exc.detail if isinstance(exc.detail, list) else [exc.detail]
            if any(str(message) == str(_('E-mail is not verified.')) for message in detail):
                raise serializers.ValidationError({
                    'non_field_errors': detail,
                    'code': 'email_not_verified',
                })
            raise


class PasswordResetSerializer(DefaultPasswordResetSerializer):
    """
    dj-rest-auth's default reset e-mail links to a Django-rendered backend
    page (reverse('password_reset_confirm')). This app has no such page -
    password reset is completed on the frontend, which then POSTs to
    /api/password/reset/confirm/ - so the emailed link must point there
    instead, mirroring the email-confirmation redirect already in place.
    """
    def get_email_options(self):
        def url_generator(request, user, temp_key):
            uid = user_pk_to_url_str(user)
            return f'{settings.FRONTEND_URL}/auth/reset-password/{uid}/{temp_key}/'

        return {'url_generator': url_generator}


class RegisterSerializer(DefaultRegisterSerializer):
    # ChoiceField (not a bare CharField) so an out-of-range or overlong value
    # is rejected as a 400 here, rather than reaching user.save() - a plain
    # .save() doesn't run the model field's max_length validation, so on
    # Postgres (this app's production DB) an unvalidated value would raise an
    # unhandled DataError instead of a clean validation error.
    language = serializers.ChoiceField(choices=settings.LANGUAGES, required=False, default='fr')

    def validate_password(self, value):
        try:
            validate_password(value)
        except exceptions.ValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value

    def save(self, request):
        user = super().save(request)
        user.language = self.validated_data['language']
        user.save()
        return user
