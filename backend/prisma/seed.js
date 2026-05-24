const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();
const DEFAULT_PERMISSIONS = {
    dashboard: true,
    orders: true,
    recipes: true,
    articles: true,
    store: true,
    suppliers: true,
    users: true,
    inventory: true,
    settings: true,
};

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
            permissions: DEFAULT_PERMISSIONS,
            activo: true,
        },
    });
    console.log('Usuario admin creado.');
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
