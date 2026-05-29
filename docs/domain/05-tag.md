# 개요
태그(Tag) : 각 기능에 걸쳐 로깅이나 보안같은 부분들을 구현하기 위한 횡단 관심사를 나타내기 위함 

# 태그(Tag) 테이블 설계
id: primary key, auto increment
name: 태그 이름 (varchar 255)
project_id : 노드가 속한 프로젝트의 id (number)

# 연관 테이블 - tag_node
id: primary key, auto increment
tag_id: 태그의 id (number)
node_id: 노드의 id (number)
