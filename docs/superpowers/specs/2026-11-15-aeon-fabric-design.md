# Aeon Fabric: architecture and staged delivery

Status: baseline architecture, 2026-11-15. D37 is owner-approved; other
technical choices are the implementer's design choices, not owner decisions.
The implemented scope is stated in the implementation and test records; this
document is not evidence that any distributed capability exists.

## 요약

Aeon Fabric은 사용자가 허락한 여러 기기의 기능을 하나의 목록과 작업 흐름으로
연결하는 구상이다. 초기에는 로컬 Controller 한 개만 활성화하며, 분리된 네트워크가
각자 Controller를 새로 선출하거나 임의로 같은 작업을 재실행하지 않는다. 기기 연결과
파일·프로그램·센서 사용 허가는 각각 다르다. 첫 구현은 현재 컴퓨터의 제한된 자원
정보를 로컬에서 확인하는 단계이며 원격 연결이나 원격 실행 기능이 아니다.

다른 네트워크를 잇는 중계 서버는 선택 사항이고 소유자가 운영하거나 선택해야 한다.
NAT나 방화벽 때문에 중계 없이 항상 연결된다고 보장할 수 없다. 여러 컴퓨터의 RAM을
하나의 RAM처럼 합치거나 임의의 GPU를 투명하게 합쳐 빠르게 만드는 기능은 목표로
약속하지 않는다. 개인용에서 출발하며 팀·기업용 고가용성과 관리 기능은 별도 단계다.

## Intent and scope

Fabric lets model-independent agents request specific operations on devices that
their owners have enrolled and authorized. It targets local-first personal use,
with team and organization extensions that do not require a vendor domain,
central service, proprietary component, paid service or cloud account. A
controller may run on an existing user's device. Offline local operation remains
possible, subject to the selected operation's own requirements.

Owner-approved choice: exactly one active logical Controller per Fabric (D37).
Engineering choices below are proposals made to satisfy the request; they are
not represented as further owner decisions. The first delivery is a local,
read-only inventory; the distributed protocol, job execution and distributed-device UI are later
milestones with explicit acceptance gates below.
This does not change D2 for Aeon's existing workflow state: Fabric's Controller
may eventually be hosted on an owner's cloud machine, but no cloud is required
for its local operating mode and its state is not the existing task store.

Out of scope for the first delivery: peer discovery, enrollment, identity,
network listeners, controller persistence, scheduling or reservations, remote
execution, file access, sensor reads, MCP server, and any claims of distributed
operation. In particular no inventory entry is a permission to use a resource.
This narrow first slice can be built without new downloads or runtime packages.

## Architecture

~~~mermaid
flowchart LR
  Human[Owner / operator] --> UI[Aeon UI or CLI]
  Agent[Any agent] --> Adapter[Local API / future MCP adapter]
  UI --> Controller[One logical Controller]
  Adapter --> Controller
  Controller --> Policy[Policy and approval]
  Controller --> State[Local durable state]
  Controller --> Scheduler[Eligibility and scheduler]
  Scheduler --> Transport[Authenticated encrypted transport]
  Transport --> W1[Worker / Node A]
  Transport --> W2[Worker / Node B]
  W1 --> Guard1[Node policy + capability adapters]
  W2 --> Guard2[Node policy + capability adapters]
  Transport -. optional .-> Relay[Self-selected relay / overlay]
~~~

* Controller owns desired registrations, signed grants, job state, audit events,
  policies and placement decisions. It can share a process with the existing
  Aeon runtime, but UI clients are not worker nodes.
* Each Node owns its own identity, local policy, adapter list, journal, actual
  resource checks and operating-system permissions. It can refuse a Controller
  request. A disconnected Controller does not turn an untrusted Node into an
  authority.
* Node adapters expose narrow, versioned operations such as a selected folder
  read, a bounded process job or a named model endpoint. A report that an
  adapter exists is not an authorization to invoke it.
* The existing Aeon agent is a client of these operations. Other agents can use
  an adapter at the boundary. Neither Fabric internals nor the policy engine
  depends on a particular model or agent framework.

### Alternatives and decisions

| Concern | Proposed choice and why | Real alternatives and costs |
|---|---|---|
| Governance | One active Controller, no automatic election. One owner has accepted the availability tradeoff; easier solo maintenance and avoids unsafe partition elections. | Multi-controller consensus (Raft etc.) needs a quorum and more machines; CRDT-only coordination cannot by itself grant exclusive side effects. Both are later independent projects. |
| State | Existing Store pattern, local SQLite for a desktop Controller once a Fabric-specific transactional store is implemented; one writer boundary. Keep Aeon's existing task store separate until semantics are proved. | Network-shared SQLite has locking and corruption risks; a client/server DB is an optional later enterprise adapter. SQLite is not itself a leader-election service. [SQLite network notes](https://www.sqlite.org/useovernet.html). |
| LAN transport | Future direct mutually authenticated TLS over TCP, pinned per-device identity and versioned framed messages; use audited platform TLS libraries. Simple locally and no required third-party server. | libp2p supplies peer identity, discovery and relays but adds substantial dependency and operational surface; evaluate it for later P2P traversal. An optional WireGuard-compatible overlay can make devices reachable but is separately configured and does not itself grant Fabric permissions. Plain Aeon HTTP signatures do not encrypt task data. |
| WAN connectivity | Direct user-provided reachable address first; opt-in self-hosted or user-selected relay when needed, with end-to-end authenticated encryption. | Hole punching can use reachable peers and relays but is not guaranteed across all NATs or firewalls; public bootstrap/relay availability, privacy and costs are not assumed. [libp2p hole punching](https://docs.libp2p.io/concepts/hole-punching). |
| RPC and integration | Small bounded, versioned Fabric messages inside the encrypted channel; MCP is a later edge adapter, not the wire protocol or policy system. | Putting MCP on every peer increases surface and does not remove authorization decisions. gRPC/protobuf offers tooling but adds generated code and dependencies. Exact wire encoding must be specified and tested before transport ships. [MCP transports](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports). |
| Execution | Named, typed operations and local resource policy; Docker or another proven isolation provider for jobs that need it, when actually available and verified. Deny unsupported isolation. | Arbitrary remote shells are easier to demo but bypass narrow permissions; containers share a kernel and are not a universal hostile-code boundary. VMs are stronger in some threat models but cost setup and resources. Aeon's existing host script mode has weaker isolation and must not be silently called a sandbox. |
| Scheduling | Filter by verified enrollment, current health, adapter, independent grant, local constraints and resource estimate; choose deterministically among remaining nodes. | A cluster scheduler such as Kubernetes gives richer capacity management but imposes infrastructure and a much larger security and maintenance footprint. An advertisement is not a reservation. |
| Data transfer | Explicit resource references, bounded streams and integrity digests over the authenticated channel; require data destination consent. | Shared network drives are convenient but do not enforce per-operation grants. Content-addressed storage is optional later; a hash does not authorize a read or hide the data. |
| Team/enterprise | Extend identities, authorization, audit export and storage behind interfaces after the personal path works. | A mandatory SSO, broker or centralized SaaS contradicts offline personal use. High availability requires a separately designed quorum and remains outside D37's first operating mode. |

### Existing projects and what to reuse

| Project | Reuse or integration | Why it is not the entire solution |
|---|---|---|
| Aeon | Reuse existing policy assessment, approval digest, workspace and network guards and task store interfaces where their guarantees actually apply. | UI-device pairing currently grants a broad admin role and LAN data is plaintext; workflow fencing does not fence an external side effect. Node-side checks must be independent. |
| libp2p | Consider its maintained secure transport, peer identity, mDNS and relay building blocks for an optional future connectivity provider. | Direct TLS and pinned identities meet the first LAN stage with fewer components; libp2p does not eliminate policy, operator trust decisions, NAT failures or relay costs. |
| WireGuard, optional Tailscale / Headscale | Allow a user-operated secure overlay as connectivity where already available. [Tailscale's OSS description](https://tailscale.com/opensource) distinguishes open clients from its coordination service and the independent Headscale server. | It adds configuration and possibly a separately operated control server; an overlay membership is not an operation grant. None is mandatory or installed automatically. |
| Syncthing | Study its pairwise device identity, explicit sharing and conflict behavior; integrate only when a user has separately chosen it. | File synchronization is not job scheduling, per-action approval or execution isolation, and conflicts are not an application-specific merge. [Syncthing FAQ](https://docs.syncthing.net/users/faq.html). |
| Ray | Consider a future adapter that submits explicitly authorized compute jobs to an already-operated Ray cluster. Its logical resource vocabulary is useful. | Ray has a head node and cluster runtime, and logical resources are scheduling quantities rather than transparent pooled RAM. It is too large to require for a personal Node. [Ray cluster concepts](https://docs.ray.io/en/latest/cluster/key-concepts.html), [resources](https://docs.ray.io/en/latest/ray-core/scheduling/resources.html). |
| Kubernetes / OCI engines | Optional later adapters for operators who already have an isolated cluster or a compatible container engine. | A control plane or container daemon is not assumed for one person's laptop; container isolation does not replace an authorization policy. |
| MCP | A future adapter can expose narrow approved Fabric operations to independent agents, using a supported MCP version and the official security guidance. | It is an integration boundary, not device authentication, a scheduler or proof a tool is safe. Existing Aeon MCP entries are catalogue data, not running Fabric tools. [MCP security](https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices). |

Build the Fabric-specific policy composition, capability contracts, controller
state machine, Node adapters and user approvals in Aeon. Reuse maintained
cryptography and isolation mechanisms; do not implement a new cipher, VPN,
container runtime, distributed consensus engine, universal filesystem or model
server. Check actual upstream licenses and platform support at adoption time.

### Protocol baseline for a future LAN milestone

The first protocol is direct TCP with TLS 1.3 mutual authentication using
per-device pinned public keys and no 0-RTT application messages. Its endpoints
are disabled until enrollment and explicit network opt-in. After TLS, each
frame has a four-byte unsigned big-endian payload length followed by one UTF-8
JSON object, maximum 1 MiB per control frame; reject oversized or invalid frames
before allocation or dispatch. This is a deliberately small baseline, not
current shipped code. Large file contents use separately bounded chunks under
the same encrypted channel and are not embedded in control messages.

Each object carries protocol major/minor, message type, request ID, Fabric ID,
sender ID and body. Peer IDs must match the authenticated certificate pin.
First exchange hello messages and negotiate a shared major version; reject
unsupported majors, unknown required fields and invalid bounds. A Controller
session sends requests and Nodes reply with the same request ID; limit
concurrency, connection time, message rate and retained response size. No
request is authorized merely because its message type is understood.

Initial read-only message types: hello, inventory.offer, inventory.request,
heartbeat and error. A Node sends an updated bounded offer after it changes;
heartbeat starts at a configurable 15-second interval and an offer is treated
as stale after 45 seconds without authenticated contact. Timers measure local
elapsed time; sleep, partitions and congestion can mark a healthy Node stale,
so stale means unavailable/unknown, not failed. Request IDs are connection
correlation only and do not prevent retries; future jobs additionally need a
durable idempotency journal. Pairing/enrollment and certificate provisioning
must be specified and reviewed separately before this listener is enabled.

Future job messages are job.prepare, job.accept or job.refuse, job.progress,
job.cancel, job.result and job.reconcile. A Node reserves capacity and records
the attempt before accept; it may reject even a previously offered capacity.
Grant and approval validation precede job.prepare acceptance. Crash, duplicate
message, process restart and cancellation must be tested at each transition.
Transport encryption protects message contents from a relay, but endpoints,
traffic metadata, compromised peers and endpoint logging remain exposed.

## Trust, enrollment and authorization

The existing Aeon device registry pairs UI clients and includes an admin flag;
it is not a Fabric Node registry or a worker authorization mechanism. The
existing LAN API can sign requests but is plaintext HTTP for ordinary task data.
Fabric must never expose it as a public encrypted worker protocol.

Future enrollment begins disabled. Generate separate purpose-specific Node and
Controller identities using maintained platform cryptography. A local person
explicitly starts a time-limited pairing session on each side and verifies both
public-key fingerprints over an independently trusted channel, for example
scanning a full authenticated QR at the other device. Unauthenticated mDNS
names, IP addresses and peer claims are hints only. Certificates and keys are
pinned to the registered identities and stored with OS protections where
available; fallback protection and key-backup limitations must be shown.

The transport must authenticate both endpoints before processing application
messages, pin the expected key, negotiate protocol version, enforce size and
time limits and avoid logging secrets. Certificate expiry, rotation, device
loss, malicious pairing, revocation, replay and rate limits need tests before
deployment. A short displayed code alone is not a replacement for a verified
authenticated key exchange. Do not write a custom cipher or roll a new PAKE.

An enrolled identity starts with zero operation grants. Controller policy and
independent Node policy must both permit the exact operation, its resource
scope, initiator, time and resource ceilings. Deny overrides ask/allow. A
grant includes issuer, audience Node identity, capability and version, concrete
resource scope, allowed operations, expiry, revocation reference and limits.
An approval is bound to a canonical digest of the immutable job, selected Node,
resource references and expiry, and cannot authorize a substituted payload.
Workers must reject unknown permissions, stale/revoked grants, mismatched
identities, stale fences and unsupported isolation; they must check OS
permissions again at execution. A compromised trusted controller cannot widen
a Node's local allowlist; a compromised Node can lie about its results.

Revocation prevents future accepted work once received; an offline Node cannot
learn revocation immediately. Short expiry and explicit fail-closed reconnect
bound that window, but cannot undo a side effect already performed. Private
files, prompts, hardware information and logs are never sent to discovery or
relay services by default. Signed code or a known identity is not proof that a
device is uncompromised. Remote output is untrusted model input.

## Data contracts and resource accounting

These are proposed domain records, not an implemented wire schema. Identifiers,
field bounds, canonical serialization, clock semantics and compatibility tests
must be fixed with the protocol implementation. Reject unknown enum values
where a safe interpretation is unavailable; bound lengths, collection sizes and
message rates.

| Record | Required information | Meaning / invariant |
|---|---|---|
| Fabric | random fabric ID, active Controller key identity, generation | One active authority. Generation is changed only by a documented, explicit recovery/handoff procedure. |
| Node | key-derived identity, public-key pin, platform, version, trust status, revocation status | Addresses and display names are mutable hints, not identity. No auto-trust from discovery. |
| Capability offer | Node ID, named adapter and version, available operations, resource descriptors, observation time, expiry | Locally observed self-report, untrusted and potentially stale. GPU/model/sensor availability may be unknown. |
| Grant | issuer, subject/initiator, audience Node, capability+operation, scope, constraints, expiry, revocation reference | Neither a paired Node nor an offer is a grant. Path scopes are resolved and checked on the executing Node. |
| Job | unique job ID, exact operation and schema version, immutable input digest, Node/resource requirements, limits, idempotency class | Job inputs are bounded; model text is never interpreted as an authorization. |
| Attempt/lease | job ID, attempt ID, Controller generation, monotonic fence, target Node, deadline, approved job digest | State transition and fence issuance are transactional at the Controller. Local checks alone cannot fence an external service. |
| Event/result | job+attempt IDs, state, sequence, bounded untrusted result reference, timestamps | Output is data, not a privileged instruction. Redact secrets and retain according to explicit policy. |

An illustrative envelope and authorization record follow. The strings are
examples, not real identities, signatures, runnable protocol traffic or shipped
APIs; the exact canonical signing format must be standardized before use.

~~~json
{
  "version": {"major": 1, "minor": 0},
  "type": "inventory.offer",
  "requestId": "req-example",
  "fabricId": "fabric-example",
  "senderId": "node-public-key-fingerprint",
  "body": {
    "adapters": [{"name": "inventory", "version": 1, "operations": ["read"]}],
    "capacity": {"logicalCpus": 4, "memoryBytes": 8589934592},
    "validForSeconds": 45
  }
}
~~~

~~~json
{
  "grantId": "grant-example",
  "issuerId": "controller-public-key-fingerprint",
  "audienceId": "node-public-key-fingerprint",
  "subjectId": "operator-example",
  "capability": "filesystem.read",
  "scope": {"resourceId": "user-selected-folder-id"},
  "limits": {"maxBytes": 1048576, "network": false},
  "expiresAt": "2026-11-16T00:00:00Z",
  "revocationId": "rev-example"
}
~~~

Inventory describes platform, architecture, logical CPU capacity and memory as
observations, not guaranteed allocations. Total memory can describe the host
rather than a container's own limit. Dynamic free memory is volatile;
available processors may be limited by OS/container rules and are not a speed
measurement. Reserve capacity on the target immediately before starting an
operation; never add RAM or GPU memory across machines to claim a single
address space. Require explicit, versioned adapters for GPU, models, network,
applications and sensors; unsupported or undetected is unknown, not enabled.

## Job lifecycle and failure semantics

1. Agent asks for a typed operation, inputs and constraints. The Controller
   validates it and evaluates policy before any candidate is contacted.
2. It filters for enrolled, non-revoked Nodes with a fresh compatible offer,
   an appropriate Controller grant and enough *estimated* capacity. The Node's
   policy and actual availability remain authoritative. If none qualifies,
   return a reason; do not fall back to an unapproved Node.
3. For sensitive work the owner sees the exact Node, operation, resource,
   network destinations, limits and isolation, and approves its digest.
4. Controller commits an attempt/fence. Node authenticates the Controller,
   verifies the approval/grant and its own policy, checks its durable journal,
   makes a local reservation and accepts or refuses. A bounded request cannot
   turn itself into another action after approval.
5. Execute only the typed adapter. Stream bounded progress/output and persist
   lifecycle events. Record completion durably and release local capacity.
6. On timeout or disconnection, do not infer the effect failed. Reconcile with
   the same Node and its journal. Retry only operations explicitly classified
   idempotent, using an idempotency key enforced by the target; an unknown
   non-idempotent outcome needs human resolution. Cancellation is best effort.

States: queued -> awaiting_approval -> dispatched -> accepted -> running ->
succeeded / failed / cancelled; disconnected after dispatch can become
outcome_unknown. A terminal answer must not be manufactured from a timeout.
Controller-side lease/fencing prevents stale Controller state writes only where
the recipient validates it. A process, filesystem or remote service that does
not validate fences can still produce duplicate or late external effects.
Therefore Fabric does not promise exactly-once execution or universal automatic
recovery. Expiry uses a locally enforced duration and bounded-skew policy, not
blind trust in a peer's wall clock; restart recovery needs a persistent journal.

### Single Controller recovery

The same process may resume from durable local state after a crash. No backup or
disconnected peer automatically promotes itself. A future manual migration must
first stop/revoke the old authority, reconcile in-flight jobs and explicitly
authorize a new Controller key/generation on each reachable Node. Until a Node
has verified the change it must reject the new authority. If an old Controller
cannot be proved stopped or revoked on a partitioned Node, the owner must leave
that Node unavailable; a local generation counter alone is not global fencing.
The future Controller must acquire an exclusive local per-Fabric process lock
and fail closed if it cannot, but this protects only processes sharing that lock
on one host. If the same private key and state are copied to another host,
Nodes cannot distinguish the clones; local locks and counters cannot prove
single authority across hosts. The operator must keep keys and backups from
running concurrently and must revoke the old key on each Node for migration.
Global enforcement would require an independent fencing authority or consensus,
neither provided by this design. Do not restore an old backup as a second live
authority. This trades availability for safety during partitions.

## Platform and physical limits

* Windows/Linux desktop/server: resource and isolation adapters depend on
  installed OS facilities and permissions. Current packaged Aeon runs its agent
  while its app is open; a persistent service is not implemented by this design.
* macOS: a Node is proposed, not currently shipped as an Aeon desktop app.
  Sandbox, accessibility, file and automation permissions differ by install
  type and require real-device testing.
* Android: app lifecycle, background starts, battery and permissions prevent
  assuming an always-on worker. Android 15+ limits certain foreground-service
  types; specific types and target versions matter. The current agent stops
  with the app process. [Android foreground-service timeouts](https://developer.android.com/develop/background-work/services/fgs/timeout).
* Web: a browser UI can be a client, not an unrestricted host process or
  general filesystem/terminal Node. Permissions and availability vary.
* Cloud is an optional user-provisioned Node; its owner pays any charges and
  configures network/security. Nothing creates an account or cloud resource.
* Parallel independent jobs can use separate CPUs/GPUs. Transparent shared
  memory, automatic pooling of arbitrary VRAM and fast distributed execution
  over arbitrary home links are not promised. Distributed ML requires supported
  frameworks, compatible hardware and sufficient interconnect bandwidth and
  latency. [NVIDIA NCCL](https://developer.nvidia.com/nccl).

## Delivery and acceptance gates

0. **Local inventory (this change):** an explicit local CLI reads platform,
   architecture, available logical CPU count and total memory, reports no
   grants and makes no network calls. An authenticated loopback-only endpoint
   and the app's device page can show the same information on request. It
   neither registers a Node nor enables a remote operation. The CLI must not
   create settings or a database.
1. **Local Controller:** durable device/grant/job state, explicit enrollment
   and revocation, audited APIs and a user-facing device page. Local adapters
   only; single-controller restart and state migration tests.
2. **Two-device LAN:** proven mutual authentication, enrollment with verified
   keys, read-only health/inventory, revocation, adversarial and real two-host
   tests. Network transport remains off until enabled. No remote execution.
3. **One narrow remote operation:** capability-specific access/approval,
   Node-side policy, journal, bounds and genuine isolation. Failure injection
   for replay, disconnect after side effect, crash, stale lease and revocation.
4. **Connectivity and adapters:** opt-in user-operated relay/overlay,
   scoped files and model integration; model-neutral MCP adapter whose security
   and supported protocol versions are tested. No third-party connectivity is
   necessary for offline/LAN use.
5. **Scale:** evaluate optional multi-user identities, audit export, quotas and
   server storage, then a separate consensus/HA design if genuinely needed.

Every step ships only what is tested and keeps denied/unsupported actions
unavailable. Real Windows, Linux, Android and macOS verification must be
recorded separately from mocks. Installation, automatic recovery and remote
execution are not proved by a unit test or by this architecture.
