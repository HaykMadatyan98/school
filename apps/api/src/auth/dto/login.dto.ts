import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '••••••••', minLength: 6 })
  @IsString()
  @MinLength(6)
  password!: string;
}
