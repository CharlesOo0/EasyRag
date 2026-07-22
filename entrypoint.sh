#!/bin/sh
set -e

python manage.py migrate --noinput
python manage.py collectstatic --noinput

# Drop from root (needed above to write into freshly-mounted volumes) to the
# unprivileged app user before running the actual server process.
exec gosu appuser "$@"
