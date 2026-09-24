import { z } from "zod";
import { email, idNumber, optionalIsoDate, optionalText, requiredText, uuid } from "./common";

export const studentSchema = z.object({
  student_number: idNumber("Student ID"),
  first_name: requiredText("First name", 100),
  middle_name: optionalText(100),
  last_name: requiredText("Last name", 100),
  email,
  program_id: uuid("Program"),
  year_level_id: uuid("Year level"),
});

export const facultySchema = z.object({
  faculty_number: idNumber("Faculty ID"),
  first_name: requiredText("First name", 100),
  middle_name: optionalText(100),
  last_name: requiredText("Last name", 100),
  email,
  birthday: optionalIsoDate("Birthday"),
  date_started: optionalIsoDate("Date started"),
  program_id: uuid("Program"),
}).superRefine((v, ctx) => {
  const today = new Date().toISOString().slice(0, 10);
  if (v.birthday && v.birthday >= today) ctx.addIssue({ code: "custom", path: ["birthday"], message: "Birthday must be in the past." });
  if (v.date_started && v.date_started > today) ctx.addIssue({ code: "custom", path: ["date_started"], message: "Date started cannot be in the future." });
  if (v.birthday && v.date_started && v.date_started <= v.birthday) {
    ctx.addIssue({ code: "custom", path: ["date_started"], message: "Date started must be after the birthday." });
  }
});

export const profileSchema = z.object({
  first_name: requiredText("First name", 100),
  middle_name: optionalText(100),
  last_name: requiredText("Last name", 100),
});
