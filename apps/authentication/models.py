from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    language = models.CharField(max_length=10, default='fr')
    is_customer = models.BooleanField(default=True)
    is_administrator = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.username} ({self.email})"
