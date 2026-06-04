

# 유저그룹 개요
프로젝트에 포함된 특정 유저들은 특정 그룹안에 포함될 수 있습니다. 

# 테이블 
테이블명 : member_group
id: primary key, auto increment
name: 그룹 이름 (varchar 255)
project_id : 그룹이 속한 프로젝트의 id (number)

테이블명 member_group_participant
id: primary key, auto increment
group_id: 그룹의 id (number)
member_id: 유저의 id (number)

# 필요한 부분
좌측 네비게이션(docs/components/02-navigation-left.md)에 그룹관리

# 관리자 권한으로 그룹 CRUD
- 그룹 생성, 삭제, 수정(그룹명) 을 할 수 있다.
- 모든 사용자들을 특정 그룹에 배치시킬 수 있다.

# 일반 사용자들
- 특정 그룹에 자신을 참여/해제 시킬 수 있다.
이 모든 것을 좌측 네비게이션에 "그룹관리" 페이지를 만들어서 이 페이지에서 동작시킬 수 있게 한다.





