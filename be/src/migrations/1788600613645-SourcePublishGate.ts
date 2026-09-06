import { MigrationInterface, QueryRunner } from "typeorm";

export class SourcePublishGate1788600613645 implements MigrationInterface {
    name = 'SourcePublishGate1788600613645'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "source" ADD "publish_allowed_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "source" ADD "image_allowed_at" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "source" DROP COLUMN "image_allowed_at"`);
        await queryRunner.query(`ALTER TABLE "source" DROP COLUMN "publish_allowed_at"`);
    }

}
