export const REPORT_TERMS = [1, 2, 3, 4] as const;

export type ReportTerm = (typeof REPORT_TERMS)[number];
export type ReportScope = "individual" | "seleccion" | "grupo";

export type ReportSubject = {
  average: number | null;
  grades: [number | null, number | null, number | null, number | null];
  id: string;
  name: string;
};

export type ReportArea = {
  average: number | null;
  id: string;
  isDirect: boolean;
  name: string;
  subjects: ReportSubject[];
};

export type ReportCard = {
  areas: ReportArea[];
  enrollmentId: string;
  finalAverage: number | null;
  recommendation: string;
  studentId: string;
  studentName: string;
  termRanks: [
    number | null,
    number | null,
    number | null,
    number | null,
  ];
};

export type ReportBatchSnapshot = {
  cards: ReportCard[];
  generatedAt: string;
  group: {
    academicYear: number;
    grade: number;
    id: string;
    level: "inicial" | "primaria" | "secundaria";
    section: string;
    teacherName: string;
  };
  institution: {
    address: string;
    motto: string;
    name: string;
    officialYearName: string;
  };
  version: 1;
};

export type ReportAssets = {
  border: string;
  crest: string;
  directorSignature: string;
  seal: string;
  watermark: string;
};
