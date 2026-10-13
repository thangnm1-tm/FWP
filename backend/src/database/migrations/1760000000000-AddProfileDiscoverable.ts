import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProfileDiscoverable1760000000000 implements MigrationInterface {
  name = 'AddProfileDiscoverable1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS discoverable BOOLEAN NOT NULL DEFAULT FALSE`,
    );
    // Only synthetic demo accounts are opted in. Real users remain private by default.
    await queryRunner.query(`
      UPDATE profiles p SET discoverable = TRUE
      FROM users u
      WHERE u.id = p.user_id
        AND u.email LIKE 'demo.student%@stu.ptit.edu.vn'
        AND p.profile_completed = TRUE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE profiles DROP COLUMN IF EXISTS discoverable`,
    );
  }
}
