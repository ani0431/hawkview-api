import { IsNotEmpty, IsString } from 'class-validator';

export class CallbackQueryDto {
  @IsString()
  @IsNotEmpty()
  admin_consent!: string;

  @IsString()
  @IsNotEmpty()
  tenant!: string;

  @IsString()
  @IsNotEmpty()
  state!: string;
}
