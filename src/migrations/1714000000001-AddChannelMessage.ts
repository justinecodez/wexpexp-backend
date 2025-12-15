import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddChannelToConversationsAndMessages1714000000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add channel to conversations if not exists
        const hasConversationChannel = await queryRunner.hasColumn("conversations", "channel");
        if (!hasConversationChannel) {
            await queryRunner.addColumn(
                "conversations",
                new TableColumn({
                    name: "channel",
                    type: "varchar",
                    default: "'WHATSAPP'",
                    isNullable: false
                })
            );
        }

        // Add channel to messages if not exists
        const hasMessageChannel = await queryRunner.hasColumn("messages", "channel");
        if (!hasMessageChannel) {
            await queryRunner.addColumn(
                "messages",
                new TableColumn({
                    name: "channel",
                    type: "varchar",
                    default: "'WHATSAPP'",
                    isNullable: false
                })
            );
        }

        // Create indexes for filtering (IF NOT EXISTS is supported by SQLite)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_CONVERSATIONS_CHANNEL" ON "conversations" ("channel")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_MESSAGES_CHANNEL" ON "messages" ("channel")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_MESSAGES_CHANNEL"`);
        await queryRunner.query(`DROP INDEX "IDX_CONVERSATIONS_CHANNEL"`);
        await queryRunner.dropColumn("messages", "channel");
        await queryRunner.dropColumn("conversations", "channel");
    }

}
