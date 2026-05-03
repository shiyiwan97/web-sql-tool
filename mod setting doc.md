# 1. 压缩等级
0-正常等级，最多的缩进，方便阅读
例如join xxx on xxx，join在上一行，on在下一行，需要有2格缩进

1-中等压缩
例如join xxx on xxx，join在上一行，on在下一行，on不缩进

2-强力压缩
例如join xxx on xxx，join在上一行，on也在同一行

# 2. 提示
1. line:xxx(块x): 表连接a表(x条)连接b表(x条)可能出现性能问题
说明，line为块开始的行号

2. line:xxx(块x): 表连接a表连接b表，连接条件和配置不同，配置为:a.fieldA=b.fieldB,...

3. 