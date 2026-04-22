import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default function Home({ users }) {
  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold text-blue-600">Utilisateurs</h1>
      <ul className="mt-4 space-y-2">
        {users.map(user => (
          <li key={user.id} className="p-2 bg-white rounded shadow">
            {user.name} - {user.email}
          </li>
        ))}
      </ul>
    </div>
  );
}

export async function getServerSideProps() {
  const users = await prisma.user.findMany();
  return { props: { users } };
}