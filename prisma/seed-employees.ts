import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Test employees derived from a sample biometric export. Their `employeeCode`
// equals the scanner enrollment id, so uploading that branch's sheet matches
// everyone automatically. Run with: pnpm db:seed:employees
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DAILY_RATE = 500;
const DATE_HIRED = new Date("2025-01-01");

const EMPLOYEES: {
  code: string;
  firstName: string;
  lastName: string;
  department: string;
}[] = [
  { code: "1", firstName: "Susan", lastName: "", department: "Company" },
  { code: "2", firstName: "Ruel", lastName: "", department: "Company" },
  { code: "3", firstName: "Job", lastName: "", department: "Admin" },
  { code: "4", firstName: "Hannah", lastName: "", department: "Admin" },
  { code: "1002", firstName: "Argie", lastName: "Calacar", department: "Production" },
  { code: "1003", firstName: "Ramil", lastName: "Estrada", department: "Production" },
  { code: "1006", firstName: "Edison", lastName: "Aroyo", department: "Production" },
  { code: "1007", firstName: "Jemar", lastName: "Cabuyaon", department: "Production" },
  { code: "1008", firstName: "Ronald", lastName: "Covena", department: "Production" },
  { code: "1009", firstName: "Randy", lastName: "Pinanongan", department: "Production" },
  { code: "1012", firstName: "Joel", lastName: "Engalan", department: "Production" },
  { code: "1014", firstName: "Harvey", lastName: "Villasis", department: "Production" },
  { code: "1015", firstName: "Irish jane", lastName: "Lamano", department: "Sales" },
  { code: "1016", firstName: "Ivy grace", lastName: "Lape", department: "Sales" },
  { code: "1017", firstName: "Jovelyn", lastName: "Togonon", department: "Sales" },
  { code: "1018", firstName: "Kristine", lastName: "Awe", department: "Sales" },
  { code: "1019", firstName: "Romeo", lastName: "Estimado", department: "Production" },
  { code: "1020", firstName: "Edwin", lastName: "Metoda", department: "Production" },
  { code: "1024", firstName: "Jason", lastName: "Villanueva", department: "Production" },
  { code: "1027", firstName: "Nail jean", lastName: "Abapo", department: "Sales" },
  { code: "1028", firstName: "Odeza ma.", lastName: "Banlaygas", department: "Sales" },
  { code: "1029", firstName: "Melanie", lastName: "Basalo", department: "Sales" },
  { code: "1030", firstName: "Rosana", lastName: "Bicoy", department: "Sales" },
  { code: "1031", firstName: "Chenanie", lastName: "Mediana", department: "Sales" },
  { code: "1032", firstName: "Angel", lastName: "Retuya", department: "Sales" },
  { code: "1033", firstName: "Kathy mae", lastName: "Saraum", department: "Sales" },
  { code: "1034", firstName: "Maria may", lastName: "Salon", department: "Sales" },
  { code: "1035", firstName: "Ramira", lastName: "Enrique", department: "Sales" },
  { code: "1036", firstName: "Roxanne", lastName: "Diaz", department: "Sales" },
  { code: "1037", firstName: "Grace", lastName: "More", department: "Sales" },
  { code: "1038", firstName: "Alanes", lastName: "Caminos", department: "Sales" },
  { code: "1039", firstName: "Lucila", lastName: "Pueter", department: "Sales" },
  { code: "1040", firstName: "Salon hykie", lastName: "Marie", department: "Sales" },
  { code: "1041", firstName: "Jesus", lastName: "Navarro", department: "Production" },
  { code: "1042", firstName: "Mechelle", lastName: "Limikid", department: "Sales" },
  { code: "1043", firstName: "Benjie", lastName: "Cabahug", department: "Production" },
  { code: "1044", firstName: "Irish kaye", lastName: "Rustia", department: "Sales" },
  { code: "1045", firstName: "Rossana", lastName: "Jadman", department: "Sales" },
  { code: "1046", firstName: "Jessica", lastName: "Bunyagan", department: "Sales" },
  { code: "1047", firstName: "Anifie", lastName: "Rivero", department: "Sales" },
  { code: "1048", firstName: "Analou", lastName: "Ignacio", department: "Sales" },
  { code: "1049", firstName: "Gerins", lastName: "Borras", department: "Production" },
  { code: "1050", firstName: "Bagay", lastName: "Manny", department: "Production" },
  { code: "1051", firstName: "Idel", lastName: "Lubiano", department: "Sales" },
  { code: "1052", firstName: "Alayssa", lastName: "Obial", department: "Sales" },
  { code: "1053", firstName: "Honey mae", lastName: "Rustia", department: "Sales" },
  { code: "1055", firstName: "Reyman", lastName: "Rustia", department: "Production" },
  { code: "1056", firstName: "Robenson", lastName: "Pis-ing", department: "Production" },
  { code: "1057", firstName: "Rex", lastName: "Laureano", department: "Production" },
  { code: "1058", firstName: "Ronald", lastName: "Covena", department: "Production" },
  { code: "1059", firstName: "Jessie", lastName: "Luchavez", department: "Production" },
  { code: "1060", firstName: "Cris john", lastName: "Daipan", department: "Production" },
];

async function main() {
  console.log(`Seeding ${EMPLOYEES.length} test employees…`);
  for (const e of EMPLOYEES) {
    const data = {
      firstName: e.firstName,
      lastName: e.lastName,
      email: `${e.code}@bernjos.test`,
      position: e.department,
      department: e.department,
      dateHired: DATE_HIRED,
      basicSalary: DAILY_RATE,
    };
    await prisma.employee.upsert({
      where: { employeeCode: e.code },
      update: data,
      create: { employeeCode: e.code, ...data },
    });
  }
  console.log("Done.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
