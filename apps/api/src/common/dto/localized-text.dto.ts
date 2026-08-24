import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Site content is Armenian-only. */
export class LocalizedTextDto {
  @ApiProperty({ example: 'Բարի գալուստ' })
  @IsString()
  @MinLength(1)
  am!: string;
}

export function normalizeLocalized(value: { am: string; en?: string; ru?: string }) {
  const am = (value.am || value.en || value.ru || '').trim();
  return { am };
}
