import re
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

# Single source of truth for the password rules enforced below - also used
# by core/settings.py's MinimumLengthValidator OPTIONS and exposed to the
# frontend via GET /api/password-policy/ (see PasswordPolicyView in
# views.py), so register.tsx/reset-password.tsx don't hardcode their own
# copy of these rules that could silently drift from what the backend
# actually enforces.
MIN_LENGTH = 9
SPECIAL_CHARS = '@$!%*?&'

class ComplexityValidator:
    def validate(self, password, user=None):
        if not re.search(r'[A-Z]', password):
            raise ValidationError(
                _("Le mot de passe doit contenir au moins une majuscule."),
                code='password_no_upper',
            )
        if not re.search(r'[a-z]', password):
            raise ValidationError(
                _("Le mot de passe doit contenir au moins une minuscule."),
                code='password_no_lower',
            )
        if not re.search(r'\d', password):
            raise ValidationError(
                _("Le mot de passe doit contenir au moins un chiffre."),
                code='password_no_digit',
            )
        if not re.search(f'[{re.escape(SPECIAL_CHARS)}]', password):
            raise ValidationError(
                _("Le mot de passe doit contenir au moins un caractère spécial (%(chars)s).") % {'chars': SPECIAL_CHARS},
                code='password_no_special',
            )

    def get_help_text(self):
        return _(
            "Votre mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial (%(chars)s)."
        ) % {'chars': SPECIAL_CHARS}
