import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Timestamp,
  UpdateDateColumn,
} from 'typeorm'

@Entity('humidity')
export class DBHumidity extends BaseEntity {
  @PrimaryGeneratedColumn('increment', {
    type: 'int',
    comment: 'Id',
  })
  rowId!: number

  @Column({
    type: 'double',
    comment: '値',
  })
  value!: number

  @CreateDateColumn({
    comment: 'データ登録日時',
  })
  createdAt!: Timestamp

  @UpdateDateColumn({
    comment: 'データ更新日時',
  })
  updatedAt!: Timestamp
}
