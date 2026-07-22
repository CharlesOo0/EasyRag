from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

User = get_user_model()


class Command(BaseCommand):
    """
    Deletes accounts that never completed OTP e-mail verification. Meant to
    be run periodically (e.g. a daily cron/scheduled task) - the OTP code
    itself already expires from the cache after 10 minutes (see
    apps/authentication/otp.py), but the unusable User/EmailAddress rows it left
    behind would otherwise accumulate forever.
    """
    help = 'Deletes accounts older than --older-than-hours that never verified their e-mail.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--older-than-hours',
            type=int,
            default=24,
            help='Only purge accounts registered longer ago than this (default: 24).',
        )

    def handle(self, *args, **options):
        cutoff = timezone.now() - timedelta(hours=options['older_than_hours'])
        stale_users = User.objects.filter(
            date_joined__lt=cutoff,
            emailaddress__primary=True,
            emailaddress__verified=False,
        )

        count = stale_users.count()
        stale_users.delete()

        self.stdout.write(self.style.SUCCESS(f'Purged {count} unverified account(s).'))
