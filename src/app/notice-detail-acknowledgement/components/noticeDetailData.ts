export const noticeDetail = {
  id: 'notice-001',
  refNumber: 'SF-2026-047',
  title: 'Airside Vehicle Incident — Taxiway Echo Closure Immediate Safety Flash',
  type: 'Safety Flash',
  category: 'Safety Flash',
  priority: 'Critical' as const,
  status: 'Active' as const,
  publishedBy: 'Karim Abdallah',
  publishedByRole: 'Administrator',
  publishedDate: '09/09/2026 08:14 EET',
  effectiveDate: '09/09/2026 08:14 EET',
  expiryDate: '10/09/2026 08:14 EET',
  approvedBy: 'Mohamed El-Sayed',
  approvedDate: '09/09/2026 08:10 EET',
  department: 'Airside Operations & Safety',
  requiresSignature: true,
  ackDeadlineHours: 4,
  body: `TO: All Airline Station Managers, Airline Duty Managers, Ground Operations Managers, Ramp Supervisors

FROM: MEAG Airside Operations & Safety Department
REFERENCE: SF-2026-047
DATE: 09 September 2026 — 08:14 EET

SUBJECT: IMMEDIATE SAFETY FLASH — Airside Vehicle Incident / Taxiway Echo Partial Closure

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. INCIDENT SUMMARY

At 07:52 EET on 09 September 2026, a ground support vehicle (Baggage Tractor Unit BT-214) operated by MEAG Ground Handling was involved in a collision with an airfield lighting unit at Taxiway Echo, approximately 340 metres from the intersection with Runway 05C at Cairo International Airport (HECA).

No personnel injuries were reported. The vehicle sustained minor damage. The airfield lighting unit (green taxiway edge light, serial CAI-TWY-E-047) is non-operational pending replacement.

2. IMMEDIATE ACTION REQUIRED

All ground operations personnel and airline representatives MUST:

a) AVOID the affected section of Taxiway Echo between marker boards E14 and E18 until further notice. Alternative routing via Taxiway Foxtrot has been coordinated with Cairo ATC — reference NOTAM HECA A0412/26.

b) REDUCE all airside vehicle speeds to 10 km/h in the vicinity of Taxiway Echo, November, and the adjacent apron stands 201–218.

c) REPORT any additional lighting or marking damage observed on the airside to MEAG Operations Control immediately on VHF 121.975 or extension 4447.

d) BRIEF all shift personnel on this safety flash before commencement of any airside vehicle operations.

3. INVESTIGATION STATUS

MEAG Safety Department has initiated a Safety Occurrence Investigation in accordance with ICAO Annex 13 and MEAG Safety Management System procedures. All ground handling supervisors on duty between 07:00–09:00 EET are requested to submit a Factual Statement to the Safety Department no later than 12:00 EET today.

4. DISTRIBUTION CHANNELS

This Safety Flash has been distributed via Email, SMS, WhatsApp Business, and Mobile App Push Notification to all registered airline representatives at Cairo International Airport.

5. FURTHER INFORMATION

Contact: MEAG Operations Control — Tel: +20 2 2265 4447 | ops.control@meag-aviation.com
Safety Department: safety@meag-aviation.com | Tel: +20 2 2265 4498

This notice requires MANDATORY ACKNOWLEDGEMENT within 4 hours of receipt.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Karim Abdallah
Administrator — MEAG Notices Platform
Airside Operations & Safety Department
Middle East Aviation Ground Handling (MEAG)`,

  attachments: [
    { id: 'att-001', name: 'SF-2026-047-Incident-Report-Preliminary.pdf', size: '284 KB', type: 'pdf' },
    { id: 'att-002', name: 'Taxiway-Echo-Closure-Map.png', size: '1.2 MB', type: 'image' },
    { id: 'att-003', name: 'NOTAM-HECA-A0412-26.pdf', size: '96 KB', type: 'pdf' },
  ],

  distributionChannels: [
    { id: 'dist-email', channel: 'Email', sent: 32, delivered: 31, failed: 1 },
    { id: 'dist-sms', channel: 'SMS', sent: 32, delivered: 30, failed: 2 },
    { id: 'dist-whatsapp', channel: 'WhatsApp', sent: 32, delivered: 29, failed: 3 },
    { id: 'dist-push', channel: 'Push', sent: 28, delivered: 26, failed: 2 },
  ],

  targetAirlines: [
    { id: 'airline-ms', airline: 'EgyptAir', iata: 'MS', totalRecipients: 6, acknowledged: 3, opened: 2, notRead: 1, complianceRate: 50, lastActivity: '09/09/2026 09:42' },
    { id: 'airline-g9', airline: 'Air Arabia', iata: 'G9', totalRecipients: 4, acknowledged: 3, opened: 1, notRead: 0, complianceRate: 75, lastActivity: '09/09/2026 09:15' },
    { id: 'airline-fz', airline: 'flydubai', iata: 'FZ', totalRecipients: 3, acknowledged: 3, opened: 0, notRead: 0, complianceRate: 100, lastActivity: '09/09/2026 08:55' },
    { id: 'airline-qr', airline: 'Qatar Airways', iata: 'QR', totalRecipients: 4, acknowledged: 2, opened: 1, notRead: 1, complianceRate: 50, lastActivity: '09/09/2026 10:01' },
    { id: 'airline-ek', airline: 'Emirates', iata: 'EK', totalRecipients: 3, acknowledged: 2, opened: 1, notRead: 0, complianceRate: 67, lastActivity: '09/09/2026 09:33' },
    { id: 'airline-tk', airline: 'Turkish Airlines', iata: 'TK', totalRecipients: 3, acknowledged: 1, opened: 0, notRead: 2, complianceRate: 33, lastActivity: '09/09/2026 08:20' },
    { id: 'airline-lh', airline: 'Lufthansa', iata: 'LH', totalRecipients: 2, acknowledged: 1, opened: 1, notRead: 0, complianceRate: 50, lastActivity: '09/09/2026 09:58' },
    { id: 'airline-ba', airline: 'British Airways', iata: 'BA', totalRecipients: 2, acknowledged: 0, opened: 0, notRead: 2, complianceRate: 0, lastActivity: '—' },
  ],

  auditTrail: [
    { id: 'audit-001', action: 'Created', user: 'Karim Abdallah', role: 'Administrator', timestamp: '09/09/2026 08:05 EET', detail: 'Notice draft created' },
    { id: 'audit-002', action: 'Approved', user: 'Mohamed El-Sayed', role: 'Dept. Head', timestamp: '09/09/2026 08:10 EET', detail: 'Approved for immediate publication' },
    { id: 'audit-003', action: 'Published', user: 'Karim Abdallah', role: 'Administrator', timestamp: '09/09/2026 08:14 EET', detail: 'Published — Email, SMS, WhatsApp, Push triggered' },
    { id: 'audit-004', action: 'Acknowledged', user: 'Omar Farid', role: 'Station Manager', timestamp: '09/09/2026 08:31 EET', detail: 'EgyptAir — Signed: Omar Farid' },
    { id: 'audit-005', action: 'Acknowledged', user: 'Rania Hassan', role: 'Duty Manager', timestamp: '09/09/2026 08:44 EET', detail: 'flydubai — Signed: Rania Hassan' },
    { id: 'audit-006', action: 'Acknowledged', user: 'Saeed Al-Mansoori', role: 'Station Manager', timestamp: '09/09/2026 08:55 EET', detail: 'flydubai — Signed: Saeed Al-Mansoori' },
    { id: 'audit-007', action: 'Read', user: 'Amira Khalil', role: 'Airline Manager', timestamp: '09/09/2026 09:02 EET', detail: 'EgyptAir — Opened, not yet acknowledged' },
    { id: 'audit-008', action: 'Escalated', user: 'System', role: 'Automated', timestamp: '09/09/2026 12:14 EET', detail: '12h escalation — Reminder email sent to 9 pending recipients' },
    { id: 'audit-009', action: 'Acknowledged', user: 'Hamad Al-Kuwari', role: 'Station Manager', timestamp: '09/09/2026 13:07 EET', detail: 'Qatar Airways — Signed: Hamad Al-Kuwari' },
    { id: 'audit-010', action: 'Acknowledged', user: 'Fatima Al-Zaabi', role: 'Duty Manager', timestamp: '09/09/2026 13:45 EET', detail: 'Air Arabia — Signed: Fatima Al-Zaabi' },
  ],
};