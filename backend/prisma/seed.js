const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
    const existing = await prisma.user.findUnique({ where: { username: 'admin' } });
    if (existing) {
        console.log('Usuario admin ya existe, omitiendo seed.');
        return;
    }
    const passwordHash = await bcrypt.hash('plantarteycafe8100', 10);
    await prisma.user.create({
        data: {
            username: 'admin',
            nombre: 'Administrador',
            passwordHash,
            activo: true,
        },
    });
    console.log('Usuario admin creado.');
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
