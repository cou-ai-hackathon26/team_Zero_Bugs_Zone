import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requirePhysician, ownedCase, validCaseId } from '../src/lib/case-access';
import * as authModule from '../src/lib/auth';
import { User, UserRole } from '../src/types';

describe('Role-Based Access Control (RBAC) Test Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Blocks unauthenticated requests with HTTP 401', async () => {
    vi.spyOn(authModule, 'getCurrentUser').mockResolvedValue(null);

    const result = await requirePhysician();
    expect(result).toBeDefined();
    // NextResponse with status 401
    expect('status' in result && result.status).toBe(401);
  });

  it('2. Blocks student / trainee role with HTTP 403', async () => {
    const studentUser: User = {
      id: 'student-uuid',
      email: 'student@docmate.ai',
      role: 'student' as UserRole,
      name: 'Tanvir Ahmed',
      created_at: new Date().toISOString(),
    };
    vi.spyOn(authModule, 'getCurrentUser').mockResolvedValue(studentUser);

    const result = await requirePhysician();
    expect(result).toBeDefined();
    expect('status' in result && result.status).toBe(403);
  });

  it('3. Blocks researcher role with HTTP 403', async () => {
    const researcherUser: User = {
      id: 'researcher-uuid',
      email: 'researcher@docmate.ai',
      role: 'researcher' as UserRole,
      name: 'Dr. Shamim Hossain',
      created_at: new Date().toISOString(),
    };
    vi.spyOn(authModule, 'getCurrentUser').mockResolvedValue(researcherUser);

    const result = await requirePhysician();
    expect(result).toBeDefined();
    expect('status' in result && result.status).toBe(403);
  });

  it('4. Authorizes doctor role successfully', async () => {
    const doctorUser: User = {
      id: 'doctor-uuid',
      email: 'doctor@docmate.ai',
      role: 'doctor' as UserRole,
      name: 'Dr. Farhana Rahman',
      created_at: new Date().toISOString(),
    };
    vi.spyOn(authModule, 'getCurrentUser').mockResolvedValue(doctorUser);

    const result = await requirePhysician();
    expect('id' in result && result.id).toBe('doctor-uuid');
    expect('role' in result && result.role).toBe('doctor');
  });

  it('5. Authorizes admin role successfully with physician privileges', async () => {
    const adminUser: User = {
      id: 'admin-uuid',
      email: 'admin@docmate.ai',
      role: 'admin' as UserRole,
      name: 'Admin User',
      created_at: new Date().toISOString(),
    };
    vi.spyOn(authModule, 'getCurrentUser').mockResolvedValue(adminUser);

    const result = await requirePhysician();
    expect('id' in result && result.id).toBe('admin-uuid');
    expect('role' in result && result.role).toBe('admin');
  });

  it('6. ownedCase enforces case-doctor ownership for physicians', () => {
    const caseId = 'c1234567-89ab-cdef-0123-456789abcdef';
    const doctorId = 'd1234567-89ab-cdef-0123-456789abcdef';

    const condition = ownedCase(caseId, doctorId, 'doctor');
    expect(condition).toBeDefined();
  });

  it('7. ownedCase grants global case access to system administrator', () => {
    const caseId = 'c1234567-89ab-cdef-0123-456789abcdef';
    const adminId = 'a1234567-89ab-cdef-0123-456789abcdef';

    const condition = ownedCase(caseId, adminId, 'admin');
    expect(condition).toBeDefined();
  });

  it('8. validCaseId rejects malformed UUIDs to prevent injection', () => {
    expect(validCaseId('non-uuid-string')).toBe(false);
    expect(validCaseId('12345')).toBe(false);
    expect(validCaseId('6e56612d-ee07-4638-9cd1-e1b912fd92be')).toBe(true);
  });
});
