import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BrandRegistryService } from './brand-registry.service';
import { Brand } from './entities/brand.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Brand])],
  providers: [BrandRegistryService],
  exports: [BrandRegistryService],
})
export class BrandsModule {}
