"""add_locker_fields

Revision ID: 45f685eb08de
Revises: 2e589c823ba7
Create Date: 2026-04-24 22:04:10.484278

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '45f685eb08de'
down_revision: Union[str, Sequence[str], None] = '2e589c823ba7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "pricing_configs",
        sa.Column("locker_daily_price", sa.Numeric(12, 2), nullable=False, server_default="0"),
    )
    op.add_column(
        "pricing_configs",
        sa.Column("locker_weekly_price", sa.Numeric(12, 2), nullable=False, server_default="0"),
    )
    op.add_column(
        "pricing_configs",
        sa.Column("locker_monthly_price", sa.Numeric(12, 2), nullable=False, server_default="0"),
    )
    op.add_column(
        "bookings",
        sa.Column("with_locker", sa.Boolean(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("bookings", "with_locker")
    op.drop_column("pricing_configs", "locker_monthly_price")
    op.drop_column("pricing_configs", "locker_weekly_price")
    op.drop_column("pricing_configs", "locker_daily_price")
