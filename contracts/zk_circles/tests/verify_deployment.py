"""
ZkCircles v13 - On-chain deployment verification tests.
Verifies zk_circles_v13.aleo is deployed on Aleo testnet with all
17 transitions, 10 mappings, 4 records, 8 structs intact.

Usage: python verify_deployment.py
"""
import urllib.request
import json
import sys

API = "https://api.explorer.provable.com/v1/testnet"
PROGRAM = "zk_circles_v13.aleo"
DEPLOY_TX = "at1z4p9fm2plx6vhna5hd3wxmvmsdh95k0gvgcpaq5snny0vk3ukupsnq28zt"

passed = 0
failed = 0


def ok(msg):
    global passed
    passed += 1
    print(f"  [PASS] {msg}")


def fail(msg):
    global failed
    failed += 1
    print(f"  [FAIL] {msg}")


def check(label, source, pattern):
    if pattern in source:
        ok(label)
    else:
        fail(f"{label} -- expected '{pattern}'")


def fetch(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "ZkCircles-Test/1.0"})
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read().decode(), r.status
    except urllib.error.HTTPError as e:
        return "", e.code
    except Exception as e:
        return "", str(e)


print()
print("=" * 60)
print("  ZkCircles v13 -- On-Chain Deployment Verification")
print("=" * 60)
print()

# 1. Program accessible
print("-- 1. Program Accessibility --")
prog, status = fetch(f"{API}/program/{PROGRAM}")
if prog and "program" in prog:
    ok(f"Program {PROGRAM} is deployed and accessible")
else:
    fail(f"Program {PROGRAM} not found (HTTP {status})")
    sys.exit(1)

# 2. All 17 transitions
print()
print("-- 2. Transitions (17 expected) --")
transitions = [
    "create_circle", "join_circle", "contribute", "claim_payout",
    "cancel_circle", "transfer_membership", "verify_membership",
    "contribute_usdcx", "claim_payout_usdcx",
    "contribute_usad", "claim_payout_usad",
    "flag_missed_contribution",
    "create_dispute", "vote_on_dispute", "resolve_dispute",
    "register_email_commitment", "verify_email_commitment",
]
for t in transitions:
    check(f"transition {t}", prog, f"function {t}")

# 3. All 10 mappings
print()
print("-- 3. Mappings (10 expected) --")
mappings = [
    "circles", "members", "contributions", "defaults", "default_flags",
    "cycle_count", "disputes", "dispute_votes", "email_commitments", "email_verified",
]
for m in mappings:
    check(f"mapping {m}", prog, f"mapping {m}:")

# 4. All 4 records
print()
print("-- 4. Records (4 expected) --")
records = ["CircleMembership", "ContributionReceipt", "PayoutReceipt", "DisputeReceipt"]
for r in records:
    check(f"record {r}", prog, f"record {r}:")

# 5. All 8 structs
print()
print("-- 5. Structs (8 expected) --")
structs = [
    "CircleInfo", "MemberKey", "ContribKey", "DefaultKey",
    "CycleKey", "DisputeInfo", "DisputeKey", "DisputeVoteKey",
]
for s in structs:
    check(f"struct {s}", prog, f"struct {s}:")

# 6. Constructor
print()
print("-- 6. Constructor --")
check("constructor edition assert", prog, "assert.eq edition 0u16")

# 7. External calls
print()
print("-- 7. External Program Calls --")
check("credits.aleo calls", prog, "credits.aleo/")
check("test_usdcx_stablecoin.aleo calls", prog, "test_usdcx_stablecoin.aleo/")
check("test_usad_stablecoin.aleo calls", prog, "test_usad_stablecoin.aleo/")

# 8. Mapping API access
print()
print("-- 8. Mapping API Access --")
for map_name in ["circles", "members", "contributions"]:
    _, code = fetch(f"{API}/program/{PROGRAM}/mapping/{map_name}/0field")
    if code in (200, 400, 404, "200", "400", "404"):
        ok(f"{map_name} mapping API responds (HTTP {code})")
    else:
        fail(f"{map_name} mapping API error (HTTP {code})")

# 9. Deployment TX
print()
print("-- 9. Deployment Transaction --")
tx_body, tx_code = fetch(f"{API}/transaction/{DEPLOY_TX}")
if tx_body and tx_code == 200:
    ok(f"Deployment TX {DEPLOY_TX[:20]}... confirmed")
else:
    fail(f"Deployment TX not found (HTTP {tx_code})")

# Summary
total = passed + failed
print()
print("=" * 60)
print(f"  Results: {passed} passed, {failed} failed, {total} total")
print("=" * 60)
print()
if failed == 0:
    print("All tests passed! zk_circles_v13.aleo is fully operational.")
else:
    print("Some tests failed. Review the output above.")

sys.exit(failed)
