# Final hackathon delivery plan — owner sign-off and historical plan

**Judging status as of November 11, 2026: JUDGE READY (owner approved).** The owner reports the finished YouTube video exceeds expectations and that the hosted three-role demonstration has completed successfully several times. This is operator acceptance; automated audit did not independently view or time the submitted video or reproduce those particular sessions.

**Submitted entry:** [Local Town Runners on Devpost](https://devpost.com/software/paypal-proofpay), submitted November 4, 2026. **Video linked in entry:** [YouTube](https://youtu.be/3_TTpw0K51g). **Hosted app:** [runners.aibrylabs.com](https://runners.aibrylabs.com). **Public source:** [GitHub](https://github.com/bryan060807/local-town-runners). The repo includes the root ISC license, judge walkthrough and setup instructions.

## Final evidence and boundaries

| Area | November 11 status | Evidence boundary |
| --- | --- | --- |
| Presentation | Owner-approved video is linked to published Devpost entry | No independent public video playback or duration check in this audit |
| User journey | Owner completed Customer → Vendor → Runner → Customer flow repeatedly | Operator-confirmed, not a fresh automated acceptance run |
| Source and production | GitHub `main` at `269eddd` matched Vercel READY production deployment before this documentation closeout | A documentation-only commit may produce a later Vercel deployment; verify its status after publication |
| Automated checks | November 2 exact-implementation CI passed **146 unit/database + 176 browser checks**, zero test failures | Latest documentation/screenshot commit made no application-code change; 16 moderate npm advisories were recorded, high-severity gate passed |
| Database | Supabase reported ACTIVE_HEALTHY; Demo Mode enabled; 3 genuine PAID Sandbox orders totaling **$44.00** and 0 duplicate genuine customer-payment credits | These are existing Sandbox transactions, not Live revenue or real payouts |
| AI | Historical hosted model requests and canonically validated planner revisions are documented | Current provider quota and live request response were not independently retested |
| Vendor showcase | Live database included 2 active real-vendor storefronts and 4 active real-vendor listings | Real showcase is distinct from fictional order/fulfillment demo |
| Submission status | Published Devpost project with video, app and repository links; submitted November 4 | Organizer eligibility decision, gallery contents and custom-answer fields were not independently confirmed |

**What remains intentionally open:** signed-out viewing, video duration and gallery review, continued AI quota/provider availability, and hosting through the December 21 winner announcement. No new financial transactions, production data changes or live-payment enablement are required. Preserve the difference between the $9 simulated fulfillment and separate $4.50 genuine Sandbox proof.

## Historical planning notes (written November 2)

The original sequence below is preserved as a planning record, **not a list of tasks still uncompleted**. The November 11 owner acceptance and published Devpost entry supersede earlier statements that the video or submission were pending.

## Additional real vendors: small, optional and time-boxed

Aim for **one more independent local vendor**, with **two additional vendors as the maximum**. A different category, such as food or a neighborhood shop, would broaden the example. One complete storefront and a genuine explanation of the vendor's problem is more useful than several sparse profiles.

- Finish intake by **November 4** and run it in parallel with video production. Do not delay recording while waiting for an applicant.
- Use the existing owner-created, email-verified application and administrator review flow. Obtain permission and review the actual consent/PDF before approval; no account impersonation or signatures on someone else's behalf.
- Each optional vendor supplies two or three approved listings, clear descriptions/prices, owner-provided photos and accurately labeled demo availability. Ask one practical question about how they currently manage orders or pickups and record their actual answer with permission.
- Existing participation is permission for the demo/Sandbox scope, not proof of paying customers, endorsement, commercial approval or measured market demand.
- Real vendors stay in the reviewed marketplace scope. Their published information also appears in the separate read-only **Participating local businesses** section inside Demo Mode on homepage refresh. Show a short expanded preview and keep the tested fictional role-switching flow for fulfillment. See [the showcase guide](demo-vendor-showcase.md); interactive real-vendor demo cloning is outside this finish plan.
- If intake requires a new capability or misses the cutoff, defer it. The submission can proceed with the participating vendor already demonstrated.

## One story for the video

Keep the [existing Fred bakery script](hackathon-demo.md). A neighbor is already heading to the shop; Sidekick helps work out an affordable choice; the people involved complete the handoff.

1. **0:00–0:15:** Fred's need and the neighbor's offer. Cinematic stills can have simple pans/zooms; a finished opening animation is not a prerequisite to recording the app.
2. **0:15–0:50:** Actual Sidekick comparison, then “Actually just the two rolls.” Show the AI-assisted label and the revised $9 total.
3. **0:50–1:25:** Review, cart, explicit order preparation and clearly labeled simulated payment.
4. **1:25–2:15:** Vendor accepts/finds runner; runner accepts; vendor marks ready; runner picks up/delivers; customer confirms completion.
5. **2:15–2:35:** Separate existing $4.50 genuine Sandbox proof: completed capture, matching PAID order, completed signed-webhook association and one customer-payment entry. Allocations remain simulated and actual payouts zero.
6. **2:35–2:50:** Brief participating-vendor/storefront cutaway, the practical benefit and app/repository URL. Keep all closing cards inside the total runtime.

Fred is the narrated person; Alex Carter is the fictional on-screen Customer. State that clearly. Before the rehearsal, set fictional runner Jordan's availability and declared trip to Demo Hearth Bakery, then return to Customer in the same private workspace. Capture the planner comparison/revision before navigating away because its conversation is temporary.

Record the complete screen story **before polishing cinematics**. Trim loading and repeated navigation while preserving the actual decisions, confirmations and results in sequence. Retain a backup recording. Never present a catalog fallback, mock model fixture or simulated payment as actual provider evidence.

## Owners and schedule

Historical schedule as drafted November 2. Actual completion evidence and operator sign-off are recorded above.

| Dates         | User / operator                                                                                                          | Assistant support and exit condition                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| **Nov 2**     | Lock the story, gather photos/voiceover materials and choose any additional vendor to invite.                            | Plan and entry draft ready; identify existing usable screenshots.                                                            |
| **Nov 2–4**   | Optional vendor invitations, their own applications and permission review; record actual feedback.                       | Help with catalog wording and observed onboarding blockers. Cutoff Nov 4; intake does not hold recording.                    |
| **Nov 3–5**   | Record the complete app walkthrough and voiceover. Capture matching completion/gallery frames during the same session.   | Review sequence, wording, AI/PayPal evidence and any actual blocker. Full first recording exists.                            |
| **Nov 5–7**   | Assemble the rough cut, then add the short cinematic opening, captions and music.                                        | Review clarity, claims, pacing and readability; final runtime remains under three minutes.                                   |
| **Nov 8–9**   | Publish final video as Public on YouTube; approve gallery and written entry. Have someone unfamiliar try the judge path. | Check signed-out/mobile links, known bugs, current deployment/CI applicability, provider access and submission instructions. |
| **Nov 10**    | Submit through the user's Devpost account and retain confirmation/public entry URL.                                      | Review the completed package for broken links or mismatched claims. A saved draft is not the acceptance check.               |
| **Nov 11–12** | Keep time available for genuine submission/access problems.                                                              | Resolve blockers without expanding the feature set. Official cutoff is Nov 12 at 2 p.m. Central.                             |

## Submission gallery

Choose four or five highlights rather than trying to make ten new gallery images:

- Neighborhood discovery or one participating local storefront.
- Actual AI comparison/revision with provenance visible.
- The cart or runner handoff from the recorded demo.
- The matching completed $9 simulated order, with its label visible.
- The separately labeled genuine Sandbox proof.

The [ten-checkpoint screenshot guide](submission-checklist.md) remains useful for supporting documentation. Existing [actual hosted AI images](screenshots/sidekick-planner/README.md) and [vendor presentation captures](screenshots/vendor-presentation/README.md) can be reused with their original captions/provenance. Do not substitute a historical $28 order screenshot as proof that the new $9 order completed.

## Final gates (November 11 reconciliation)

- [x] Owner approves finished submitted video; Devpost project has a YouTube URL. Independent runtime/public-view verification remains open.
- [x] Owner reports repeated successful three-role customer/vendor/runner completion in the hosted demo.
- [x] Public repository, ISC license, Vercel READY production deployment and submitted Devpost entry verified.
- [x] Existing Sandbox captures and one-per-order genuine customer-payment credits were checked read-only against Supabase; no real payouts are implied.
- [x] Submission narrative distinguishes AI-backed choices, canonical validation, genuine Sandbox payment and explicitly simulated fulfillment.
- [ ] Confirm signed-out video visibility, runtime below three minutes, and all judge-access links; not independently checked in this audit.
- [ ] Confirm media permissions, gallery images and any private on-screen details; operator-controlled evidence.
- [ ] Keep the app, Demo Mode and required AI/provider quota available until the December 21 winner announcement, in accordance with organizer updates.
- [ ] Independently confirm the entrant's custom fields and eligibility responses if another editing pass is warranted before the deadline.

Monitoring, restore drills, retention automation, commercial launch, sponsored billing and real payouts remain separate rollout work. They are not presented as completed or added as dependencies for this hackathon package.
