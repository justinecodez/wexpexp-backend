"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../src/config/database");
database_1.AppDataSource.initialize()
    .then(async () => {
    try {
        await database_1.AppDataSource.runMigrations();
        console.log('Migrations completed successfully');
        process.exit(0);
    }
    catch (error) {
        console.error('Error running migrations:', error);
        process.exit(1);
    }
})
    .catch(error => {
    console.error('Error initializing database:', error);
    process.exit(1);
});
//# sourceMappingURL=migration.js.map