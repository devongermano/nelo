# Permission Matrix

This document defines the role-based access control (RBAC) matrix for Nelo. All permissions are evaluated within the context of a specific project.

## Roles

- **OWNER**: Full control over the project and all its resources
- **MAINTAINER**: Can manage project settings and moderate content
- **WRITER**: Can create and edit content
- **READER**: Read-only access to content

## Permission Matrix

### Project Management

| Action | OWNER | MAINTAINER | WRITER | READER | Description |
|--------|:-----:|:----------:|:------:|:------:|-------------|
| project.create | ✅ | ❌ | ❌ | ❌ | Create new projects |
| project.delete | ✅ | ❌ | ❌ | ❌ | Permanently delete project |
| project.update | ✅ | ✅ | ❌ | ❌ | Update project settings/metadata |
| project.archive | ✅ | ✅ | ❌ | ❌ | Archive/unarchive project |
| project.export | ✅ | ✅ | ✅ | ❌ | Export entire project |
| project.import | ✅ | ✅ | ❌ | ❌ | Import project data |

### Team Management

| Action | OWNER | MAINTAINER | WRITER | READER | Description |
|--------|:-----:|:----------:|:------:|:------:|-------------|
| member.invite | ✅ | ✅ | ❌ | ❌ | Invite new members |
| member.remove | ✅ | ✅ | ❌ | ❌ | Remove members |
| member.role.change | ✅ | ❌ | ❌ | ❌ | Change member roles |
| member.list | ✅ | ✅ | ✅ | ✅ | View team members |

### Content Management

| Action | OWNER | MAINTAINER | WRITER | READER | Description |
|--------|:-----:|:----------:|:------:|:------:|-------------|
| book.create | ✅ | ✅ | ✅ | ❌ | Create books |
| book.update | ✅ | ✅ | ✅ | ❌ | Edit book metadata |
| book.delete | ✅ | ✅ | ❌ | ❌ | Delete books |
| chapter.create | ✅ | ✅ | ✅ | ❌ | Create chapters |
| chapter.update | ✅ | ✅ | ✅ | ❌ | Edit chapter metadata |
| chapter.delete | ✅ | ✅ | ❌ | ❌ | Delete chapters |
| scene.create | ✅ | ✅ | ✅ | ❌ | Create scenes |
| scene.update | ✅ | ✅ | ✅ | ❌ | Edit scene content |
| scene.delete | ✅ | ✅ | ✅ | ❌ | Soft delete scenes |
| scene.restore | ✅ | ✅ | ❌ | ❌ | Restore deleted scenes |
| scene.read | ✅ | ✅ | ✅ | ✅ | View scene content |

### Codex (Story Bible)

| Action | OWNER | MAINTAINER | WRITER | READER | Description |
|--------|:-----:|:----------:|:------:|:------:|-------------|
| entity.create | ✅ | ✅ | ✅ | ❌ | Create entities (characters, locations, etc.) |
| entity.update | ✅ | ✅ | ✅ | ❌ | Edit entity details |
| entity.delete | ✅ | ✅ | ❌ | ❌ | Delete entities |
| entity.read | ✅ | ✅ | ✅ | ✅ | View entities |
| canon.create | ✅ | ✅ | ✅ | ❌ | Add canon facts |
| canon.update | ✅ | ✅ | ✅ | ❌ | Edit canon facts |
| canon.delete | ✅ | ✅ | ❌ | ❌ | Remove canon facts |
| canon.reveal | ✅ | ✅ | ❌ | ❌ | Change reveal states |

### AI Features

| Action | OWNER | MAINTAINER | WRITER | READER | Description |
|--------|:-----:|:----------:|:------:|:------:|-------------|
| ai.generate | ✅ | ✅ | ✅ | ❌ | Use AI generation (WRITE/REWRITE/DESCRIBE) |
| ai.model.select | ✅ | ✅ | ✅ | ❌ | Choose AI model for generation |
| ai.provider.add | ✅ | ✅ | ❌ | ❌ | Add provider API keys |
| ai.provider.update | ✅ | ✅ | ❌ | ❌ | Update provider settings |
| ai.provider.delete | ✅ | ❌ | ❌ | ❌ | Remove provider keys |
| ai.budget.set | ✅ | ✅ | ❌ | ❌ | Set spending limits |
| ai.budget.view | ✅ | ✅ | ✅ | ❌ | View usage/costs |

### Refactoring

| Action | OWNER | MAINTAINER | WRITER | READER | Description |
|--------|:-----:|:----------:|:------:|:------:|-------------|
| refactor.create | ✅ | ✅ | ✅ | ❌ | Create refactor request |
| refactor.preview | ✅ | ✅ | ✅ | ❌ | Preview refactor changes |
| refactor.apply | ✅ | ✅ | ❌ | ❌ | Apply refactor patches |
| refactor.force | ✅ | ❌ | ❌ | ❌ | Force apply conflicting patches |
| refactor.reject | ✅ | ✅ | ❌ | ❌ | Reject refactor patches |

### Collaboration

| Action | OWNER | MAINTAINER | WRITER | READER | Description |
|--------|:-----:|:----------:|:------:|:------:|-------------|
| comment.create | ✅ | ✅ | ✅ | ✅ | Add comments to scenes |
| comment.update | ✅ | ✅ | Own | Own | Edit comments (own = own comments only) |
| comment.delete | ✅ | ✅ | Own | ❌ | Delete comments |
| comment.resolve | ✅ | ✅ | ✅ | ❌ | Mark comments as resolved |
| suggestion.create | ✅ | ✅ | ✅ | ❌ | Make content suggestions |
| suggestion.apply | ✅ | ✅ | ❌ | ❌ | Apply suggestions |
| suggestion.reject | ✅ | ✅ | ❌ | ❌ | Reject suggestions |

### Security & Privacy

| Action | OWNER | MAINTAINER | WRITER | READER | Description |
|--------|:-----:|:----------:|:------:|:------:|-------------|
| security.e2ee.enable | ✅ | ✅ | ❌ | ❌ | Enable E2E encryption |
| security.e2ee.disable | ✅ | ❌ | ❌ | ❌ | Disable E2E encryption |
| security.audit.view | ✅ | ❌ | ❌ | ❌ | View audit logs |
| security.keys.rotate | ✅ | ❌ | ❌ | ❌ | Rotate encryption keys |
| privacy.export.own | ✅ | ✅ | ✅ | ✅ | Export own data |
| privacy.delete.own | ✅ | ✅ | ✅ | ✅ | Delete own account |

### Style & Settings

| Action | OWNER | MAINTAINER | WRITER | READER | Description |
|--------|:-----:|:----------:|:------:|:------:|-------------|
| style.create | ✅ | ✅ | ✅ | ❌ | Create style guides |
| style.update | ✅ | ✅ | ✅ | ❌ | Edit style guides |
| style.delete | ✅ | ✅ | ❌ | ❌ | Delete style guides |
| prompt.create | ✅ | ✅ | ✅ | ❌ | Create prompt presets |
| prompt.update | ✅ | ✅ | ✅ | ❌ | Edit prompt presets |
| prompt.delete | ✅ | ✅ | ❌ | ❌ | Delete prompt presets |

## Special Rules

### 1. Owner Override
The OWNER role has implicit permission for all actions within their project, regardless of the matrix above.

### 2. Self Actions
Users can always perform certain actions on their own resources:
- Update their own profile
- Delete their own comments
- Revoke their own project membership
- Export their own data (GDPR compliance)

### 3. Inheritance
Permissions are NOT inherited by hierarchy. Each role has explicit permissions only.

### 4. Project Context
All permissions are evaluated within a specific project context. A user can have different roles in different projects.

### 5. Team Context
For team-owned projects, the team owner has OWNER permissions on all team projects.

## Implementation Notes

### Permission Check Flow
1. Authenticate user (JWT validation)
2. Identify project context from request
3. Fetch user's role in project (ProjectMember table)
4. Check permission matrix for role + action
5. Apply special rules (owner override, self actions)
6. Allow or deny (403 Forbidden if denied)

### Caching Strategy
- Cache user roles per project (5 minute TTL)
- Cache permission matrix in memory
- Invalidate on role changes

### Audit Requirements
Log all permission checks for:
- Security-sensitive actions (delete, role changes)
- Failed permission checks (potential attacks)
- E2EE toggle events

## API Response Codes

- `200 OK` - Action allowed and successful
- `403 Forbidden` - User lacks permission for action
- `404 Not Found` - Resource doesn't exist (or user can't see it)
- `401 Unauthorized` - Not authenticated

## Future Enhancements

1. **Delegated Permissions**: Temporary permission grants
2. **Custom Roles**: Project-specific role definitions
3. **Fine-grained Permissions**: Per-chapter or per-scene permissions
4. **Workflow Permissions**: Approval workflows for certain actions
5. **Time-based Permissions**: Permissions that expire
6. **IP-based Restrictions**: Limit certain actions to specific IPs