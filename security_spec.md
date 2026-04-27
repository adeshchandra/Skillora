# Security Specification: Skillora Base

## 1. Data Invariants

1.  **Identity Integrity:** A user cannot impersonate another user. `ownerId` or `userId` fields in created documents must match the authenticated `request.auth.uid`.
2.  **Relational Sync:** A learning request cannot be accepted (Session created) unless the request exists and the user is the intended recipient.
3.  **Credit Protection:** A user cannot join a DAO group unless they have enough credits (handled via transaction in code, but rules should prevent manual bypassing if possible).
4.  **Content Ownership:** Only the creator/admin of a Course or DAO Group can modify its properties.
5.  **Notification Privacy:** Notifications are strictly private for reading but can be created by other users to alert the target.
6.  **Immutable History:** Once a session or request reaches a terminal state (Completed/Cancelled/Declined), it cannot be modified further (locking logic).

## 2. The "Dirty Dozen" Payloads (Red Team Test Cases)

| ID | Collection | Action | Payload / Scenario | Expected |
|:---|:---|:---|:---|:---|
| 01 | `users` | Update | `{ credits: 999999 }` (Attempt to self-grant wealth) | **DENIED** |
| 02 | `notifications` | Read | Fetching `notifications` where `userId != auth.uid` | **DENIED** |
| 03 | `learningRequests` | Create | `{ senderId: 'hacker_id', ... }` (Spoofing sender) | **DENIED** |
| 04 | `learningRequests` | Update | Recipient trying to change `credits` or `learnSkill` | **DENIED** |
| 05 | `sessions` | Create | Creating a session without an associated learning request | **DENIED** |
| 06 | `sessions` | Update | Learner trying to mark a session as `Completed` early | **DENIED** |
| 07 | `courses` | Delete | User A trying to delete User B's course | **DENIED** |
| 08 | `daoGroups` | Update | Non-admin trying to change `stakedPoints` or `joinDeadline` | **DENIED** |
| 09 | `daoGroups/members` | Create | Joining a group and setting `pointsStaked: 0` | **DENIED** |
| 10 | `notifications` | Create | Creating a 1MB notification message string | **DENIED** |
| 11 | `sessions` | Update | Changing `teacherId` after the session is created | **DENIED** |
| 12 | `users` | Create | Creating a user profile with an ID that matches an admin's ID | **DENIED** |

## 3. Test Runner Strategy (Pseudo-logic)

All write operations must pass the `isValid[Entity]()` helper which checks:
- Type safety (e.g., `credits is int`)
- Size bounds (e.g., `displayName.size() <= 64`)
- Identity matching (`senderId == request.auth.uid`)
- Terminal state locking (`existing().status != 'Completed'`)
