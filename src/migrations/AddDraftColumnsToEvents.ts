import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddDraftColumnsToEvents1693417200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('events', [
      new TableColumn({
        name: 'last_autosave_at',
        type: 'timestamp',
        isNullable: true,
      }),
      new TableColumn({
        name: 'published_at',
        type: 'timestamp',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('events', 'last_autosave_at');
    await queryRunner.dropColumn('events', 'published_at');
  }
}
