"use client";

import type { UserRole } from "@/generated/prisma/enums";
import type { ResourcePageData } from "@/modules/dashboard/resource-data";

import { ClassEditor } from "./class-editor";
import { ContentEditor } from "./content-editor";
import {
  AttendanceEditor,
  AuditEditor,
  GradingEditor,
  JobEditor,
  ReportEditor,
  SettingEditor,
} from "./operations-editor";
import { SessionEditor } from "./session-editor";
import { SubjectEditor } from "./subject-editor";
import { UserEditor } from "./user-editor";

export function ResourceEditor({
  data,
  actor,
  defaults,
}: {
  data: ResourcePageData;
  actor: { id: string; role: UserRole };
  defaults: { type?: string; classId?: string };
}) {
  if (data.section === "users") {
    return (
      <UserEditor
        mode={data.mode}
        actorRole={actor.role}
        entity={data.entity}
        users={data.options.users}
      />
    );
  }
  if (data.section === "subjects") {
    return <SubjectEditor mode={data.mode} entity={data.entity} actorRole={actor.role}/>;
  }
  if (data.section === "classes") {
    return (
      <ClassEditor
        mode={data.mode}
        canEdit={data.canEdit}
        entity={data.entity}
        subjects={data.options.subjects}
        classes={data.options.classes}
        users={data.options.users}
        actorRole={actor.role}
      />
    );
  }
  if (data.section === "sessions") {
    return (
      <SessionEditor
        mode={data.mode}
        canEdit={data.canEdit}
        entity={data.entity}
        classes={data.options.classes}
        defaultClassId={defaults.classId}
        actorRole={actor.role}
      />
    );
  }
  if (data.section === "contents") {
    return (
      <ContentEditor
        mode={data.mode}
        actorId={actor.id}
        actorRole={actor.role}
        entity={data.entity}
        classes={data.options.classes}
        sessions={data.options.sessions}
        defaultType={defaults.type}
        defaultClassId={defaults.classId}
      />
    );
  }
  if (data.section === "attendance") {
    return <AttendanceEditor entity={data.entity} />;
  }
  if (data.section === "grading") {
    return <GradingEditor entity={data.entity} actorRole={actor.role} />;
  }
  if (data.section === "reports") {
    return (
      <ReportEditor
        mode={data.mode}
        entity={data.entity}
        classes={data.options.classes}
        actorRole={actor.role}
      />
    );
  }
  if (data.section === "jobs") {
    return <JobEditor entity={data.entity} />;
  }
  if (data.section === "audit") {
    return <AuditEditor entity={data.entity} />;
  }
  if (data.section === "settings") {
    return <SettingEditor mode={data.mode} entity={data.entity} />;
  }
  return null;
}
