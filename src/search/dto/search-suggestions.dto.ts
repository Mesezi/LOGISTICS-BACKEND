import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SearchSuggestionsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  q: string;
}
