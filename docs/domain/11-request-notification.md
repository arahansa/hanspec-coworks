


# 개요

요구사항에서 특정 그룹(docs/domain/10-user-group.md) 이나 개인(docs/domain/02-member.md)에게 태그를 걸어서 확인 요청을 보낼 수 있다.

요청을 받은 그룹이나, 개인은 해당 요청을 체크(checked) 할 수 있다.
요청을 보낸 사람은 요청을 상대방이 확인하였는지 알 수 있다.


# 테이블
테이블명 : request_notification
id: primary key, auto increment
sender_id: 요청을 보낸 사람의 id (number, member 테이블의 id 참조)
receiver_id: 요청을 받은 사람의 id (number, member 테이블의 id 참조)
group_id: 요청을 받은 그룹의 id (number, member_group 테이블의 id 참조)
checked: 요청이 확인되었는지 여부 (boolean)
checked_at: 요청이 확인된 시간 (timestamp)

# 화면
- 좌측 네비게이션 화면(docs/components/02-navigation-left.md) 에서 "요청 알림" 페이지를 만들어서, 이 페이지에서 자신이 받은 요청과 보낸 요청을 확인할 수 있게 한다. (탭으로 구분)
- 페이징 형태로 요청 목록이 나타나며, 요청과 Node 정보가 같이 나온다.
- 받은 요청이 먼저 나오고, 받은 요청에 해당하는 Node의 이름, 설명과 tag가 나오도록 한다. 좌측에 체크 여부를 동작시키게 할 수 있으며 체크되면 checked가 true로 바뀌고 checked_at이 현재 시간으로 업데이트 된다.
- 보낸 사람은 자신이 보낸 요청과, 해당 요청이 확인되었는지 여부를 볼 수 있다.
