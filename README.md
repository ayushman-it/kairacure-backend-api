# Kairacure Backend API (`kairacure-backend-api`)

Enterprise RESTful API backend microservice powering Kairacure Medical Travel Platform & Admin System.

## Key Features & Security Architecture
- **RESTful Endpoints**: Patients, Treatments, Hospitals, Doctors, Inquiries, Admin Operations.
- **AES-256-GCM Encryption**: Application-layer field-level PHI encryption for sensitive patient records.
- **AWS S3 Presigned URLs**: Secure document access pattern with temporary, short-lived signed URLs.
- **Role-Based Access Control (RBAC)**: Scoped route security for SuperAdmin, MedicalDirector, HospitalAdmin, CaseCoordinator, Auditor.
- **Two-Factor Authentication (2FA)**: Mandatory RFC 6238 TOTP validation for administrative actions.
- **Immutable Audit Engine**: Structured event logging tracking PHI viewing, record downloads, and administrative changes.

## Quick Start
```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Run development server
npm run dev
```
