import pytest

from app.vm_control import _parse_resource_id


def test_parses_a_normal_resource_id():
    sub, rg, name = _parse_resource_id(
        "/subscriptions/8ac0a59e-a2ba-4781-92bd-5ee9b609ff7e"
        "/resourceGroups/easyrag-prod-rg"
        "/providers/Microsoft.Compute/virtualMachines/easyrag-vm"
    )
    assert sub == "8ac0a59e-a2ba-4781-92bd-5ee9b609ff7e"
    assert rg == "easyrag-prod-rg"
    assert name == "easyrag-vm"


def test_accepts_lowercase_provider_casing_from_some_azure_apis():
    sub, rg, name = _parse_resource_id(
        "/subscriptions/x/resourcegroups/rg/providers/microsoft.compute/virtualmachines/vm"
    )
    assert (sub, rg, name) == ("x", "rg", "vm")


@pytest.mark.parametrize(
    "bad_id",
    [
        "",
        "not-a-resource-id",
        "/subscriptions/x/resourceGroups/rg/providers/Microsoft.Compute/disks/d",
        "/subscriptions/x/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/vm/extra",
    ],
)
def test_rejects_malformed_or_wrong_type_ids(bad_id):
    with pytest.raises(ValueError):
        _parse_resource_id(bad_id)
