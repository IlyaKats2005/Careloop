# Demo update status — 30 October 2026

This records prepared changes, not a claim of publication or completed submission.

| Requested improvement | Verified result | Remaining external work |
| --- | --- | --- |
| Always-on relay | Compose configuration validates; Dockerfile, persistent journal migration and heartbeat check prepared | Provision an always-on host, migrate private state, start it and verify fresh payments |
| Real payout and hold rehearsal | Existing automatic payout receipt retained; approval/hold and proof/payment tests pass | Run both new cases through the live UI; external Gemini/Cardano access is required |
| Onboarding | Enrollment creation and recovery controls added to check-in; status refresh tests pass | Publish and visually verify in a browser |
| Submission package | Setup/deployment/rehearsal instructions and a ≤2.5-minute narration prepared | Confirm public GitHub access, record the actual video, submit Devfolio |
| Masumi clarity | Demo readiness screen explicitly distinguishes direct website Gemini calls from the separate paid Masumi service; real prior receipts linked | Publish the screen; it does not add a Masumi purchase to each form |

Validation: application build; 184 application tests plus a separate heartbeat test; 30 Masumi tests. A clean directory installed 160 dependencies from the offline npm cache with install scripts disabled, then passed the build and the 184+30 suites. This does not verify Aiken's network-dependent postinstall on a fresh online machine. Docker Compose configuration was validated; the Docker image could not be built because daemon access was denied.

Environment blockers: local DNS cannot resolve GitHub or the Sites source host, CLI GitHub authentication is unavailable in this session, browser control is not exposed, and Docker daemon access is denied. No new live payment, remote worker deployment, publication, GitHub push, video recording or Devfolio submission is claimed for this update.
